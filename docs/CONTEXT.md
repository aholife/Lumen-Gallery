# 当前开发上下文

> 最后更新：2026-10-13
> 当前焦点模块：**Lumen Gallery v2 — React 重写 + Cloudflare Workers 部署**（设计已定稿，待实现）

## 🎯 目标

**2026-10-13 决定完整 React 重写**，取代 Astro + React islands。动机是四个体验痛点（详情页渐进加载、标签筛选瀑布流动画、手机双列切换、EXIF 面板布局）与 Afilmory 差距过大，在 Astro 上打补丁成本不低于重写。部署目标同步改为 **Cloudflare Workers**。

> **完整设计见 [`docs/superpowers/specs/2026-10-13-react-rewrite-workers-design.md`](./superpowers/specs/2026-10-13-react-rewrite-workers-design.md)**
> 决策记录见 [DECISIONS.md](./DECISIONS.md)「2026-10-13」条目
> 实施阶段见 [TODO.md](./TODO.md)「v2 重写」

**新架构速览：** Vite + React 19 SPA + react-router v7 + Zustand + motion/GSAP Flip + **WebGL/WebGPU 渲染面** + Tailwind v4，部署 Cloudflare Workers Static Assets。构建流水线（`src/lib/**`、`scripts/build-images*.ts`、`photos.json` 契约）**原样复用**。

多尺寸缩略图（300w/800w/1600w）已于 2026-05-27 由用户明确**取消**，v2 **继续维持**单张 800w WebP — Afilmory 的渐进阶梯（Thumbhash → 缩略图 → 原图）也不需要多尺寸。

## 📌 项目概况

- **项目名称**: Lumen Gallery
- **核心技术**: Astro + TypeScript + Tailwind CSS + React（复杂交互组件）
- **存储方案**: Cloudflare R2（主要）/ Local / GitHub（可切换）
- **图片处理**: Sharp（格式转换/缩略图）+ exifr（EXIF）+ thumbhash（占位符）
- **部署**: Netlify（`netlify` 分支持有部署配置），站点 `gallery.echorains.top`，图片 CDN `photos.echorains.top`
- **当前阶段**: MVP 已上线，进入 P1 功能开发

## ✅ 已完成

### 基础设施
- [x] 项目初始化（Astro + TS + Tailwind）
- [x] 多存储适配器（Local, R2, GitHub）
- [x] 环境变量配置（.env + dotenv 兼容 Node 脚本）

### 图片处理流水线
- [x] 格式转换（HEIC/TIFF → JPEG）
- [x] 单张 WebP 缩略图生成（800w，自动旋转）
- [x] EXIF 元数据提取（相机、GPS、拍摄参数）
- [x] ThumbHash 占位符生成（替代 BlurHash）
- [x] 基于目录结构的自动标签生成
- [x] 构建产物生成（`public/photos.json`）
- [x] R2 全托管模式 — 缩略图上传到 R2，本地仅保存 photos.json
- [x] R2 增量构建 — 基于 ETag 检测原图变更，跳过未变更图片，同名替换会触发重新处理
- [x] **照片排序** — 构建时按 `exif.dateTime` 降序写入 `photos.json`（最新在前；无 EXIF 日期的排最后）

### 前端页面
- [x] 基础布局组件（Header, Footer）
- [x] 博客功能（基于 Astro Content Collections）
- [x] 画廊数据源接入
- [x] 响应式瀑布流画廊（MasonicGallery）
- [x] ThumbHash 懒加载占位符
- [x] 图片详情/全屏查看器（PhotoViewer overlay）
- [x] EXIF 信息展示面板
- [x] **Viewer Overlay 改造** — `GalleryWithViewer.tsx`
  - PhotoCard 改用 onClick 回调，保留右键新标签打开
  - URL 同步（`history.pushState` + `popstate` 监听）
  - 胶片条虚拟化渲染（`@tanstack/virtual`）
  - 键盘导航（←/→/Esc/i）、焦点归还
  - 缩放手势（滚轮/双击/双指捏合）、拖拽平移
  - 原图加载失败自动降级到缩略图
  - 共享 Photo 类型（`src/types/photo.ts`）
  - 删除冗余 `BlurHashImage.astro`

### 标签系统
- [x] **标签浏览页面** — `/tags/`，Astro SSG 读取 photos.json 提取唯一标签
- [x] **TagBrowser 组件** — 搜索栏 + 多选标签筛选 + MasonicGallery + PhotoViewer
  - 搜索匹配：标签名、文件名、相机制造商/型号、镜头型号
  - 筛选逻辑：标签 OR，搜索 AND 标签
  - `useDeferredValue` 优化搜索输入响应
  - 筛选变化时自动修正 viewer 索引
- [x] **侧边栏入口** — Author.astro 添加"浏览标签"链接

### 部署
- [x] **Netlify 上线**（2026-09-08）— `netlify` 分支持有 `netlify.toml` / `site` URL；`dev` 不保留部署配置
- [x] 双域名配置 — 站点 `gallery.echorains.top`（`astro.config.mjs` `site`）/ 图片 `photos.echorains.top`（`R2_PUBLIC_URL`）
- [x] 构建命令 `pnpm install && pnpm build:r2`（先装依赖再跑图片流水线，`tsx` 是 devDependency）
- [x] 站点标识 — `src/consts.ts`（落花流水集·影 / 偶尔拍拍 / Aholife），`index.astro` 改用 `SITE_TITLE`/`SITE_DESCRIPTION` 常量

## ⏳ 待办（Next）

### 🔥 v2 React 重写（2026-10-13 起，当前最高优先级）

详见设计文档，分 6 个阶段：

- [ ] **Phase 0** — Vite + React + react-router 脚手架，`wrangler.jsonc` Workers 部署打通
- [ ] **Phase 1** — 数据层（内联 photos.json）+ 画廊网格 + 手机双列/单列切换
- [ ] **Phase 2** — Viewer 渐进加载（Thumbhash → 缩略图 → 原图 blob + 进度条 + LRU）+ 共享元素转场
- [ ] **Phase 3** — **WebGL / WebGPU 渲染面**（移植 Afilmory `webgl-viewer`，LOD 放大不糊 + 惯性平移）
- [ ] **Phase 4** — EXIF 面板（PC 右侧默认展开 / 手机底部抽屉默认收起）
- [ ] **Phase 5** — 标签筛选 + GSAP Flip 瀑布流重组动画
- [ ] **Phase 6** — 收尾清理（移除 Astro/blog/netlify）+ 通测 + 文档更新

### 部署收尾（旧，已并入 v2 或作废）
- [ ] 重跑构建脚本，生成按拍摄时间排序后的 `photos.json`（排序代码已就位，产物尚未重生成）
- [ ] 决定是否将 `pnpm-lock.yaml` 从 `.gitignore` 移出并提交（Netlify 安装可复现性；用户中断过一次修复）
- [ ] 清理 `netlify.toml` 中意图不明的 `NPM_FLAGS = "--version"`
- [ ] `src/lib/image/exif.ts` 补读 `OffsetTimeOriginal`，修正展示时区（详见 AFILMORY_LEARNINGS §6）

### P1 功能
- [ ] 图片分享功能（Web Share API + OG meta）
- [ ] 暗色模式

### P2 功能
- [ ] 地图视图（EXIF GPS 数据）
- [ ] 性能优化（构建缓存、R2 持久化缓存）

### 技术债（标签系统评审遗留）
- [ ] 抽取 photos.json 读取/解析公共工具（`index.astro` 与 `tags/index.astro` 重复）
- [ ] `JSON.parse` 失败的错误提示与「Photos not processed yet」区分
- [ ] 移除 `.astro` 页面中的死导出 `title/description/pubDate`
- [ ] 搜索框 a11y（`aria-label` / `type="search"` / 清除按钮）
- [ ] `closeViewer` 的 `setTimeout(100)` 增加卸载保护

## 🔑 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| **前端框架（2026-10-13）** | **Vite + React 19 SPA 重写** | 对齐 Afilmory 体验；Astro islands 复刻成本过高 |
| **路由（2026-10-13）** | react-router v7 | Afilmory 同款；`/photos/:id` 深链 |
| **状态管理（2026-10-13）** | Zustand | viewer/gallery/URL 三态耦合（推翻「暂不引入 Zustand」） |
| **动画（2026-10-13）** | motion + GSAP Flip | motion 管 viewer 转场；GSAP Flip 管标签筛选重组 |
| **渲染面（2026-10-13）** | **WebGPU 优先 + WebGL 降级** | LOD 放大不糊 + 惯性平移；推翻 2026-02-10「不用 WebGL」 |
| **部署（2026-10-13）** | Cloudflare Workers Static Assets | 与 R2 同生态；推翻 Netlify 方案 |
| 主存储 | Cloudflare R2 | 零出口流量费，S3 兼容 API |
| 占位符 | ThumbHash（非 BlurHash） | 体积更小、质量更高、支持透明度 |
| 缩略图格式 | WebP | 更高效压缩，更好质量 |
| 缩略图策略 | 单张 800w（v2 继续维持） | Afilmory 也是单张缩略图 + Thumbhash + 原图三级阶梯 |
| 全屏查看 | SPA 路由 `/photos/:id` + 共享元素转场 | 推翻 Astro Overlay + `[...slug].astro` 兜底 |
| 照片排序 | 构建时按 `exif.dateTime` 降序写入 `photos.json` | 前端零改动，画廊/查看器/胶片条顺序自动一致 |
| 多尺寸缩略图 | 取消（2026-05-27，v2 不恢复） | 渐进加载靠 Thumbhash→800w→原图，无需 srcset |

## 📌 注意事项

### 构建 / 脚本
- Node/tsx 脚本不支持 `import.meta.env`，需用 `dotenv/config` 加载环境变量
- R2 兼容性需配置 `requestChecksumCalculation` 和 `responseChecksumValidation`
- R2 中 `size=0` 的对象为目录标记，需在文件列表阶段过滤
- R2 构建默认忽略 `.thumbnails` 目录，可通过 `R2_IGNORE_DIRS` 环境变量追加其他忽略目录
- **`tsc`/`astro check` 在本仓库不可用**（TypeScript 非直接依赖；`astro check` 在非交互 shell 会卡在安装确认）——**验证一律用 `pnpm build`**
- **照片顺序**：`photos.json` 数组顺序即展示顺序。排序在两个构建脚本保存前按 `exif.dateTime` 降序完成；无 EXIF 日期的照片排最后。改排序逻辑后需重跑构建脚本才会反映到产物

### 部署（Netlify）
- 构建命令必须是 `pnpm install && pnpm build:r2` —— `tsx` 是 devDependency，不先装依赖会报 `tsx: not found`
- **不要**给静态 Astro 站点加 SPA 风格 `[[redirects]]`；带 `conditions = { Role = [...] }` 的重定向会让普通访客全站 404
- 双域名不可混：`site` = `gallery.echorains.top`（SEO/OG 绝对 URL），`R2_PUBLIC_URL` = `photos.echorains.top`（图片/缩略图 URL）
- 构建产物被 gitignore（`public/photos.json` / `public/photos/` / `public/processed/`），Netlify 必须在构建时跑图片流水线
- R2 密钥在 Netlify UI 用 "Add key/value pairs" 配置，不要 import `.env`
- `pnpm-lock.yaml` 目前被 gitignore，Netlify 安装不可复现（待决）
- 部署配置（`netlify.toml`、`site` URL）只存在于 `netlify` 分支；`consts.ts`/`index.astro` 这类耦合改动需双分支落地

### 图片处理
- `sharp.rotate()` 自动根据 EXIF Orientation 旋转，`getImageDimensions()` 需考虑旋转后尺寸
- **竖拍宽高**：EXIF Orientation 5-8 时，`photos.json` 输出的 `width`/`height` 需要互换（以展示尺寸为准）
- **EXIF 时区**：`DateTimeOriginal` 不含时区，需配合 `OffsetTimeOriginal` 字段；缺失时按相机本地时间展示，不强制换算 UTC
- GPS 数据展示需做模糊化处理以保护隐私

### 前端交互
- **事件监听器**：所有 `addEventListener` 必须在 `useEffect` cleanup 中对应 `removeEventListener`，且函数引用必须一致（不能用匿名函数），否则内存泄漏
- **history 时序**：`history.pushState` 必须在 `setState` 之后执行，避免 `popstate` 与 React 状态竞争
- **ThumbHash 批量解码**：放入 `requestIdleCallback`，避免阻塞主线程
- **iOS Safari 手势**：`touchmove` 需显式声明 `{ passive: false }` 才能在 iOS 中 `preventDefault`；双击用 300ms 时间差判断，不依赖 `dblclick` 事件
- **SSR Hydration**：`GalleryWithViewer` 需 `client:only="react"` + `isMounted` 防御
- **原图降级**：原图加载失败时，`onError` 回退到缩略图展示

## 📂 关键文件索引

| 文件 | 用途 |
|------|------|
| `src/lib/storage/` | 统一存储接口（Local/R2/GitHub） |
| `src/lib/image/` | 图片处理（EXIF/缩略图/ThumbHash） |
| `scripts/build-images-r2.ts` | R2 模式构建脚本 |
| `scripts/build-images.ts` | 本地模式构建脚本 |
| `src/types/photo.ts` | 共享 Photo 类型定义（对齐 photos.json） |
| `src/components/GalleryWithViewer.tsx` | Viewer Overlay 状态容器 + URL 同步 |
| `src/components/MasonicGallery.tsx` | 瀑布流画廊组件（onClick 回调模式） |
| `src/components/PhotoViewer.tsx` | 图片查看器（胶片条 + 缩放 + 键盘导航） |
| `src/components/TagBrowser.tsx` | 标签浏览（搜索 + 多选筛选 + 画廊） |
| `src/pages/index.astro` | 首页（使用 GalleryWithViewer） |
| `src/pages/tags/index.astro` | 标签浏览页面 |
| `src/pages/Gallery/[...slug].astro` | 画廊 fallback 页面（直链/SEO 兜底） |
| `public/photos.json` | 构建产物 — 图片元数据清单（数组顺序 = 展示顺序） |
| `netlify.toml` | Netlify 部署配置（**仅 `netlify` 分支**） |
| `src/consts.ts` | 站点标题/描述/作者信息 |
| `CLAUDE.md` | Claude Code 项目指南（**仅 `netlify` 分支**） |
| `docs/AFILMORY_LEARNINGS.md` | Afilmory 参考手册（防坑指南） |
