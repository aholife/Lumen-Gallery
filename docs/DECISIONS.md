# 技术决策记录

> 采用轻量 ADR（Architectural Decision Record）格式。
> 帮助 AI 和开发者理解"为什么这么设计"，避免重复讨论。

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

### 理由
- 简化构建流程和存储结构
- 800w 足以覆盖瀑布流展示和中等屏幕
- 减少 R2 存储和构建时间
- 多尺寸可在 P1 阶段按需添加

### 后果
-  构建速度快，存储成本低
- ⚠️ 大屏/Retina 可能略显模糊
- ⚠️ 小屏加载略有浪费

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
