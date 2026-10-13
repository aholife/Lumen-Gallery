# 技术决策记录

> 采用轻量 ADR（Architectural Decision Record）格式。
> 帮助 AI 和开发者理解"为什么这么设计"，避免重复讨论。

---

## 2026-10-13：启用 WebGL / WebGPU 图片渲染（推翻「暂不使用 WebGL」）

> 完整设计见 [`docs/superpowers/specs/2026-10-13-react-rewrite-workers-design.md` §5.1b](./superpowers/specs/2026-10-13-react-rewrite-workers-design.md)

### 背景
早期（2026-02-10）决定第一版不用 WebGL，理由是「PixiJS/Three.js 增加 200KB+ JS，对图片展示体验提升不明显」。
但用户反馈 Afilmory 的渲染手感明显更好。本项目原图为 8574×5716 / 约 20MB，CSS `transform: scale()` 放大会糊，
而 Afilmory 的 `@afilmory/webgl-viewer` 通过 GPU 纹理 + 客户端 LOD 瓦片在 10–20x 仍保持锐利。

### 考虑选项
- **A. 继续 CSS `<img>` + transform** — 简单，放大糊
- **B. 移植 Afilmory `webgl-viewer`（WebGPU 优先 + WebGL 降级 + LOD + HDR Gain Map）** — 约 4200 行
- **C. 自研简化 WebGL 纹理渲染（无 LOD）** — 缩放仍糊，只解决抖动

### 决定
选择 **B. 移植 Afilmory `packages/webgl-viewer`**，路径 `src/web/modules/viewer/webgl-viewer/`。
实施分步：先 WebGL-only 跑通，再加 WebGPU 引擎与 HDR gainmap。

### 理由
- LOD 是「放大不糊」的关键，自研简化版达不到同等体验
- 客户端从原图 blob 生成瓦片，**无需服务端预切片**，`photos.json` 契约不变
- WebGPU 不可用时自动切 WebGL，再退 `<img>`，兼容性链路完整
- 与 `ProgressiveImage` 天然衔接：缩略图 `<img>` 先上屏，blob 就绪后挂 `ImageViewer`

### 关键实现
- 引擎：`ImageViewerEngineBase`（手势/物理）+ `WebGLImageViewerEngine` + LOD 瓦片 Worker
- 渲染面：`<ImageViewer src={blobUrl} width height onLoad onError onZoomChange />`
- 降级：WebGPU → WebGL → `<img>` CSS transform；降级时保留缩放平移位置
- 纹理预算 128 MiB（大图 8574×5716 RGBA 约 190MB，必须走瓦片/降采样）
- HDR：`jpeg-gainmap.ts` 支持 Adobe XMP / ISO 21496-1 增益图

### 后果
- ✅ 放大看细节不糊；平移有惯性手感；缩放 HUD 平滑
- ✅ 有增益图的照片可出真 HDR
- ⚠️ **推翻 2026-02-10「不使用 WebGL 渲染器」决策**
- ⚠️ 移植量大（~4200 行），需真机验证 iOS Safari 纹理上限
- ⚠️ JS 体积增加；但换来的是查看器核心体验

---

## 2026-10-13：完整 React 重写 + 部署迁移到 Cloudflare Workers

> 完整设计见 [`docs/superpowers/specs/2026-10-13-react-rewrite-workers-design.md`](./superpowers/specs/2026-10-13-react-rewrite-workers-design.md)

### 背景
Astro + React islands 已跑通 Viewer Overlay / 标签系统并上线，但与 Afilmory 体验差距明显：
1. 详情页直接加载 16–23MB 原图 + spinner，无 Thumbhash → 缩略图 → 原图 渐进感
2. 标签筛选时 Masonry 被 `key={Date.now()}` 硬重挂，无瀑布流重组动画
3. 手机端 `columnWidth=240` 只能排 1 列
4. EXIF 面板手机/PC 布局都不对（两套重复 sidebar）

同时部署目标改为 Cloudflare Workers（图片已在 R2，同生态、零出口流量费）。

### 考虑选项
- **A. Astro 上打补丁** — 保留框架，只改 4 个体验点
- **B. Vite + React SPA 完整重写** — 与 Afilmory 同构，复用构建流水线
- **C. Next.js App Router 重写** — 项目早期分析过的方案（见 PROJECT_SUMMARY.md）

### 决定
选择 **B. Vite + React SPA + react-router v7**，部署 **Cloudflare Workers Static Assets**。

### 理由
- Afilmory 的体验来自一整套客户端状态机（ProgressiveImage / FLIP / LRU blob cache），在 Astro islands 里复刻成本不低于重写
- 交互全是客户端，不需要 RSC/SSR；SPA 更贴近参考实现
- 构建流水线（`src/lib/**`、`scripts/build-images*.ts`）零 Astro 耦合，可原样复用
- Next.js 的 API Routes / RSC / next/image 本项目用不到（YAGNI）
- Workers 与 R2 同属 Cloudflare，`not_found_handling: "single-page-application"` 原生支持 SPA 深链

### 关键实现
- 状态：**Zustand**（AFILMORY_LEARNINGS 明确后悔没一开始就用）
- 动画：**motion**（viewer 共享元素/淡入）+ **GSAP Flip**（标签筛选瀑布流重组）
- 布局：**masonic** 沿用，单元格按 `width/aspectRatio` 预定尺寸（零 CLS）
- 渐进加载：Thumbhash → 800w WebP → 原图（XHR blob + 进度），**无需多尺寸缩略图**

### 后果
- ✅ 体验可真正对齐 Afilmory；同一 Cloudflare 生态部署
- ⚠️ **推翻 2026-05-25「继续 Astro + React Islands」决策**
- ⚠️ **推翻 2026-09-08 Netlify 部署方案**（`netlify` 分支部署配置作废）
- ⚠️ 博客 / RSS / Astro Content Collections 一并砍掉（原为脚手架占位内容）
- ⚠️ SEO 转为 SPA 客户端渲染；OG meta 后续用 Worker HTMLRewriter 注入
- ✅ **不推翻** 2026-05-27「取消多尺寸缩略图」— Afilmory 也是单张缩略图 + Thumbhash + 原图三级阶梯

---

## 2026-09-08：照片排序策略

## 2026-09-08：照片排序策略

### 背景
`photos.json` 与页面展示顺序此前**没有任何显式排序**：Local 为 `readdir()` 文件系统顺序，R2 为 key 字典序，GitHub 为 Contents API 目录内字母序。需要按拍摄时间降序（最新在前）展示。

### 考虑选项
- **A. 前端排序** — 在 `GalleryWithViewer` / `MasonicGallery` 渲染前对 `photos.json` 排序
- **B. 构建时排序** — 在 `scripts/build-images.ts` 与 `build-images-r2.ts` 保存元数据前排序

### 决定
选择 **B. 构建时排序**。

### 理由
- `photos.json` 是唯一真相源，顺序固化在产物里，前端零改动
- 画廊、PhotoViewer 胶片条、`[...slug].astro` 上下张导航均按数组下标工作，构建时排一次全部自动一致
- R2 增量构建跳过的条目原本会停留在旧位置；统一末尾排序后增量/全量输出顺序一致

### 关键实现
```ts
metadata.sort((a, b) => {
  const dateA = a.exif?.dateTime ? new Date(a.exif.dateTime).getTime() : 0;
  const dateB = b.exif?.dateTime ? new Date(b.exif.dateTime).getTime() : 0;
  return dateB - dateA;
});
```
- 排序键 `exif.dateTime`（`exif.ts` 取 `DateTimeOriginal || DateTime`）
- 无 EXIF 日期的照片 `getTime()` 为 0，排到列表末尾
- 前端完全无 `sort`/`reverse` 逻辑

### 后果
- ✅ 展示顺序稳定、可预测
- ⚠️ 改排序逻辑后必须重跑构建脚本，`photos.json` 才会更新
- ⚠️ `exif.ts` 未读 `OffsetTimeOriginal`，展示时间可能有系统性时区偏移（排序内部自洽，不受影响）

---

## 2026-09-08：Netlify 部署方案

### 背景
需要把站点部署到 Netlify。构建产物（`public/photos.json` 等）被 gitignore，Netlify 检出的仓库里没有现成元数据，必须在构建时跑图片流水线。

### 考虑选项
- **A. 部署配置进 `dev`** — 配置与代码同分支
- **B. 独立 `netlify` 分支** — 部署配置隔离，`dev` 保持干净

### 决定
选择 **B. 独立 `netlify` 分支**（用户明确「dev分支不保留」）。存储模式选定 **R2**。

### 理由
- 部署配置（`netlify.toml`、`site` URL、CLAUDE.md）与业务代码解耦
- R2 模式：图片留在 Cloudflare R2，Netlify 只构建前端；`build:r2` 在部署时下载原图、生成 800w WebP、上传缩略图回 R2、写出 `photos.json` 再 `astro build`

### 关键实现
- `netlify.toml`：`command = "pnpm install && pnpm build:r2"`，`publish = "dist"`，`NODE_VERSION = 20`
- 双域名：站点 `gallery.echorains.top`（`astro.config.mjs` `site`，影响 SEO/OG 绝对 URL）；图片 CDN `photos.echorains.top`（`R2_PUBLIC_URL`）
- R2 密钥在 Netlify UI 用 "Add key/value pairs" 配置，不 import `.env`
- 耦合文件（`consts.ts`、`index.astro`）需双分支落地，用 `git checkout <branch> -- <path>` 同步

### 后果
- ✅ 站点上线，`dev` 无部署噪音
- ⚠️ `pnpm install` 不能省略 —— `tsx` 是 devDependency，漏装会 `tsx: not found`
- ⚠️ 静态 Astro 站点不要加 SPA/角色条件 `[[redirects]]`，会让普通访客全站 404
- ⚠️ `pnpm-lock.yaml` 被 gitignore，Netlify 安装不可复现（待决）

---

## 2026-05-27：标签系统实现方案

### 背景
标签数据已在构建时由 `extractTagsFromPath()` 从目录结构提取，存入 `photos.json`。需要实现前端浏览和筛选体验。

### 考虑选项
- **A. 顶部标签栏 + 画廊筛选** — 标签栏固定在首页上方，点击筛选下方内容
- **B. 独立标签页面** — `/tags/` 独立页面，顶部标签 + 搜索 + 画廊

### 决定
选择 **B. 独立标签页面**。

### 理由
- 用户偏好独立页面，不希望首页布局被改变
- 标签筛选 + 搜索功能组合更适合独立页面
- 首页保持简洁的画廊体验

### 关键实现
- `TagBrowser.tsx`：React Island 组件，搜索栏 + 多选标签 + MasonicGallery + PhotoViewer
- `src/pages/tags/index.astro`：Astro SSG 页面，读取 photos.json 提取标签
- 搜索匹配：标签名、文件名、相机制造商/型号、镜头型号
- 筛选逻辑：标签 OR，搜索 AND 标签
- `useDeferredValue` 优化搜索输入响应
- 筛选变化时自动修正 viewer 索引
- 侧边栏 Author.astro 添加入口链接

### 后果
- ✅ 首页布局不变，标签功能独立
- ✅ 复用现有 MasonicGallery + PhotoViewer 组件
- ✅ 搜索功能扩展了标签系统的发现能力
- ⚠️ 无 URL 同步（纯前端状态）

---

## 2026-05-25：Viewer Overlay 实现方案

### 背景
需要实现不刷新页面的图片查看体验（overlay 模式），对标 Afilmory。

### 考虑选项
- **A. 迁移 Next.js** — 使用 Parallel Routes 实现 Modal Overlay
- **B. Astro + React Islands** — 在现有架构下用 `history.pushState` + `useState` 实现

### 决定
选择 **B. Astro + React Islands**。

### 理由
- Viewer Overlay 的状态复杂度可控（`currentIndex: number | null`），不需要 Zustand
- `history.pushState` + `popstate` 事件足以实现 URL 同步
- `[...slug].astro` SSG 页面保留直链/SEO 兜底
- 避免框架迁移带来的成本和风险
- `@tanstack/virtual` 解决胶片条性能问题

### 关键实现
- `GalleryWithViewer.tsx`：状态容器，管理 viewer 开关 + URL 同步
- `MasonicGallery.tsx`：PhotoCard 改用 `onClick` 回调，保留 `<a>` 用于右键新标签
- `PhotoViewer.tsx`：虚拟化胶片条 + 缩放手势 + 键盘导航
- `src/types/photo.ts`：共享类型，对齐 `photos.json`

### 后果
- ✅ 无需框架迁移，保持 Astro SSG 的性能优势
- ✅ 直链 fallback 保留 SEO
- ⚠️ 需手动管理 `popstate` 监听器清理和 hooks 调用顺序

---

## 2026-02-11：ThumbHash 替代 BlurHash

### 背景
需要为图片生成低字节占位符，在懒加载时提供视觉过渡。

### 考虑选项
- **A. BlurHash** — 成熟方案，社区广泛使用
- **B. ThumbHash** — 更新方案，体积更小、质量更高

### 决定
选择 **B. ThumbHash**。

### 理由
- 体积比 BlurHash 更小
- 视觉质量更高
- 支持透明度（BlurHash 不支持）
- 编解码性能相当

### 后果
-  更好的用户体验
- ⚠️ 需更新前端解码逻辑（`thumbHashToRGBA`）
- 受影响：`processor.ts`, `types.ts`, `MasonicGallery.tsx`, `BlurHashImage.astro`

---

## 2026-02-10：Cloudflare R2 作为主存储

### 背景
图片资源已存储在 Cloudflare R2，需要选择主存储后端。

### 考虑选项
- **A. 本地/GitHub 存储 + 构建处理** — 免费，适合 <500 张
- **B. Cloudinary CDN** — 自动处理，有免费额度
- **C. AWS S3** — 灵活可控，出口流量费高
- **D. Cloudflare R2** — S3 兼容 API，零出口流量费

### 决定
选择 **D. Cloudflare R2** 作为核心存储。

### 理由
- 零出口流量费，极适合图片博客的高带宽场景
- S3 兼容 API，可复用 AWS SDK
- 绑定自定义域名即获得 Cloudflare CDN 加速
- 图片与代码完全分离，仓库保持轻量

### 架构
```
R2 Bucket/
├── photos/         # 原图（用户上传）
└── .thumbnails/    # 缩略图（构建时生成上传）

本地仓库/
└── public/photos.json  # 仅元数据清单
```

### 后果
-  仓库轻量，只有 photos.json
-  充分利用 Cloudflare CDN
- ⚠️ 需配置 R2 兼容性参数（checksumCalculation）
- ⚠️ 构建时需网络访问 R2

---

## 2026-02-11：WebP 作为默认缩略图格式

### 背景
需要选择缩略图输出格式。

### 考虑选项
- **A. JPEG** — 最广泛兼容
- **B. WebP** — 更高效压缩
- **C. AVIF** — 最佳压缩率，但兼容性有限

### 决定
选择 **B. WebP** 作为默认格式，AVIF 作为未来升级路径。

### 理由
- 同画质下比 JPEG 小 25-35%
- 浏览器兼容性已非常好（>95%）
- Sharp 原生支持，无额外依赖
- 未来可通过 `<picture>` 标签添加 AVIF 降级

### 后果
-  更小的文件体积，更快的加载速度
-  实现简单

---

## 2026-02-10：单张缩略图策略（800w）

### 背景
原计划生成多尺寸缩略图（300w/800w/1600w），需评估 MVP 阶段的实际需求。

### 考虑选项
- **A. 多尺寸响应式** — 300w/800w/1600w + `<picture>` srcset
- **B. 单张 800w** — 简化流程，覆盖大多数场景

### 决定
MVP 阶段选择 **B. 单张 800w**。
**2026-05-27 更新：多尺寸缩略图（300w/800w/1600w）由用户明确取消，不再作为 P1 升级路径。**

### 理由
- 简化构建流程和存储结构
- 800w 足以覆盖瀑布流展示和中等屏幕
- 减少 R2 存储和构建时间
- 多尺寸可在 P1 阶段按需添加

### 后果
-  构建速度快，存储成本低
- ⚠️ 大屏/Retina 可能略显模糊
- ⚠️ 小屏加载略有浪费
-  多尺寸方案已取消（2026-05-27），当前策略长期维持单张 800w

---

## 2026-02-10：不使用 WebGL 渲染器

### 背景
原计划考虑用 PixiJS/Three.js 实现高性能渲染。

### 决定
**第一版不使用 WebGL**，优先 CSS + Intersection Observer。

### 理由
- PixiJS/Three.js 增加 200KB+ JS 体积
- 对图片展示的实际体验提升不明显
- CSS Grid + JS 控制已能满足瀑布流需求
- 仅在特殊效果页面（3D 相册）才考虑

---

## 2026-02-10：Astro View Transitions 替代传统查看器

### 背景
需要实现从瀑布流点击进入图片详情的过渡效果。

### 考虑选项
- **A. PhotoSwipe** — 成熟的全屏图片查看库
- **B. Astro View Transitions** — 原生页面过渡 API

### 决定
优先尝试 **B. Astro View Transitions**，必要时补充 PhotoSwipe。

### 理由
- 原生 Shared Element Transition，图片平滑形变过渡
- 无需额外 JS 库
- 与 Astro 深度集成，实现简洁

```html
<!-- 列表页 -->
<img src={thumb} transition:name={`photo-${id}`} />
<!-- 详情页 -->
<img src={full} transition:name={`photo-${id}`} />
```

### 后果
-  极简实现，体验优秀
- ⚠️ 手势缩放等高级功能仍需 PhotoSwipe 补充

---

## 通用：Node 脚本环境变量加载

### 背景
Astro/Vite 在构建时注入 `import.meta.env`，但 tsx 直接执行的 Node 脚本无此机制。

### 决定
脚本入口添加 `import 'dotenv/config'`，`getEnv()` 保持双重兜底（`import.meta.env` → `process.env`）。

### 理由
- 兼容 Astro 页面和 Node 脚本两种运行时
- dotenv 是轻量 devDependency，无运行时负担

### 后果
-  统一的环境变量访问方式
- ⚠️ 脚本入口需记得 import dotenv
