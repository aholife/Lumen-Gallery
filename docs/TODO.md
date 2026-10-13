# 项目待办清单

> 基于开发计划四阶段 + 优先级排序，跟踪全局进度。
> 详细当前任务见 [CONTEXT.md](./CONTEXT.md)。
> **2026-10-13 起主线为 v2 React 重写**，见设计文档 [`superpowers/specs/2026-10-13-react-rewrite-workers-design.md`](./superpowers/specs/2026-10-13-react-rewrite-workers-design.md)。

---

## v2 重写（2026-10-13 起，当前主线）

> Vite + React 19 SPA + react-router v7 + Zustand + motion/GSAP Flip
> 部署：Cloudflare Workers Static Assets
> 构建流水线 / `src/lib/**` / `photos.json` 契约**原样复用**

### Phase 0 — 脚手架 + 部署打通
- [ ] `vite.config.ts` + `index.html` + `src/web/main.tsx` + react-router 空路由
- [ ] `wrangler.jsonc`（`not_found_handling: "single-page-application"`）
- [ ] `package.json`：移除 Astro 依赖，新增 react-router / zustand / motion / gsap；保留 sharp/exifr/thumbhash/aws-sdk/tsx
- [ ] 验证 `pnpm process-images:r2 && pnpm build && wrangler dev` 全链路

### Phase 1 — 数据层 + 画廊网格
- [ ] 构建期内联 `photos.json`，`Photo` 类型补 `aspectRatio`
- [ ] Zustand `galleryStore`
- [ ] `MasonryView` + `MasonryPhotoItem`（Thumbhash + 800w 懒加载 + 预定尺寸零 CLS）
- [ ] 手机默认双列（150px 列宽目标）+ `ColumnToggle`（1列/2列/自动，localStorage）
- [ ] 桌面自动列宽（250px 目标，上限 8 列）

### Phase 2 — Viewer 渐进加载（核心体验）
- [ ] `ProgressiveImage` 三级状态机：Thumbhash → 800w 缩略图 → 原图 blob
- [ ] `ImageLoaderManager`：XHR 进度 + 10 张 LRU blob 缓存
- [ ] `LoadingIndicator` 玻璃进度条（300ms 延迟后才出现）
- [ ] 网格已解码缩略图 → 跳过淡入（零闪烁进入）
- [ ] 共享元素转场（motion，grid 单元格 → viewer frame，0.42s）
- [ ] 胶片条虚拟化 + 键盘导航
- [ ] URL 同步 `/photos/:id`（`setState` 先于 `pushState`）
- [ ] 原图失败降级：保留缩略图 + 错误玻璃条
- [ ] 渲染面临时用 `<img>`，接口先对齐 `ImageViewer` props（为 Phase 3 铺路）

### Phase 3 — WebGL / WebGPU 渲染面（新增 2026-10-13）
> 移植 Afilmory `packages/webgl-viewer`（约 4200 行）→ `src/web/modules/viewer/webgl-viewer/`
> 设计见 spec §5.1b；ADR 见 DECISIONS.md

- [ ] `ImageViewerEngineBase`（手势/物理/视口状态）移植
- [ ] `WebGLImageViewerEngine` + `shaders.ts` + LOD 瓦片生成（Worker 从 blob 解码）
- [ ] Phase 2 的 `<img>` 渲染面换成 `<ImageViewer src={blobUrl} />`，首帧 `onLoad` 后卸载缩略图
- [ ] 缩放 HUD（`onZoomChange`）+ 平移惯性调参
- [ ] 三级降级：WebGPU → WebGL → `<img>` CSS transform（保留视口）
- [ ] （可选）`jpeg-gainmap.ts` HDR Gain Map（Adobe XMP / ISO 21496-1）
- [ ] （可选）`WebGPUImageViewerEngine` + texture worker
- [ ] 验证：20MB 原图放大 10x 仍锐利；纹理预算 128MiB 不超；iOS 真机；降级不白屏

### Phase 4 — EXIF 面板
- [ ] 统一 `ExifPanel` 组件（废除两套重复 sidebar）
- [ ] PC `≥1024px` 右侧滑入，默认展开
- [ ] 手机 `<1024px` 底部抽屉，默认收起
- [ ] 分区：基本信息 / 拍摄参数 / 设备 / 标签 / GPS（模糊化）
- [ ] `src/lib/image/exif.ts` 补 `OffsetTimeOriginal` 时区修正
- [ ] （可选）区域标注 overlay — 复用 `ImageViewportState`

### Phase 5 — 标签筛选 + GSAP Flip 重组
- [ ] `TagBrowser`：搜索 + 多选标签（沿用 OR∩AND 过滤逻辑）
- [ ] `AnimatedMasonry`：GSAP Flip 重组动画（`absolute: true`，stagger 0.02）
- [ ] **删除** `key={shrunk-Date.now()}` remount hack，改 `reposition()` + Flip
- [ ] 搜索框 a11y（`type="search"` / `aria-label` / 清除按钮）
- [ ] 筛选时 viewer 索引钳制

### Phase 6 — 收尾 + 清理
- [ ] `/about` 简单页（用 `AUTHOR_INFO`）
- [ ] 移除全部 Astro 文件、blog 占位、`netlify` 相关
- [ ] 深链 / 刷新 / 前进后退 通测
- [ ] 手机手势回归（iOS `touchmove` passive:false、300ms 双击、pinch 与 swipe 互斥）
- [ ] 更新 `docs/CONTEXT.md` / `DECISIONS.md` / `TODO.md` / `CLAUDE.md`

### v2 验证清单
- [ ] 网格滚动：thumbhash 先上、缩略图淡入、无布局跳动
- [ ] 点击进入：无黑屏 spinner
- [ ] 快速切张：相邻张只有缩略图；返回秒开（LRU）
- [ ] **WebGL：放大 10x 仍锐利；平移有惯性；缩放 HUD 平滑**
- [ ] **WebGL 降级：禁用 GPU / 老浏览器 → 自动退回 `<img>`，不白屏**
- [ ] 标签筛选：FLIP 重组动画，无闪断
- [ ] 手机：默认双列可切单列；EXIF 默认收起
- [ ] PC：EXIF 右侧默认展开；`/photos/:id` 直链可用
- [ ] `wrangler deploy` 后深链不 404
- [ ] 断网 / 404 原图 — 降级到缩略图，不白屏

---

## 历史阶段（Astro 时代，已完成或随 v2 作废）

### 第一阶段：基础设施搭建 

- [x] Astro + TypeScript + Tailwind CSS 初始化
- [x] 目录结构设计
- [x] 多存储抽象层实现（LocalStorage / R2Storage / GitHubStorage）
- [x] 环境变量配置（.env + dotenv 兼容）
- [x] R2 S3 兼容配置（checksumCalculation 兼容性修复）

## 第二阶段：图像处理流水线 

- [x] 扫描存储源中的图片
- [x] Sharp 格式转换（HEIC/TIFF → JPEG）
- [x] 单张 WebP 缩略图生成（800w + `sharp.rotate()` 自动旋转）
- [x] exifr 提取 EXIF（含 GPS）
- [x] ThumbHash 占位符生成（替代 BlurHash）
- [x] 基于目录路径自动生成标签
- [x] 输出 JSON 清单（`public/photos.json`）
- [x] R2 全托管模式（缩略图上传 R2，本地仅 photos.json）

## 第三阶段：前端交互开发 🔄

### P0 — 必须完成

- [x] 基础布局组件（Header, Footer）
- [x] 博客功能（Astro Content Collections）
- [x] 画廊数据源接入
- [x] 响应式瀑布流画廊（MasonicGallery）
- [x] ThumbHash 懒加载占位符
- [x] 图片详情/全屏查看器（PhotoViewer overlay）
- [x] EXIF 信息展示面板

### P0+ — Viewer Overlay 改造（对标 Afilmory）

> 详细方案见 [PLAN-viewer-overlay.md](./plan/PLAN-viewer-overlay.md)
> 防坑指南见 [AFILMORY_LEARNINGS.md](./AFILMORY_LEARNINGS.md)

- [x] **共享类型 `src/types/photo.ts`** — 统一 `Photo` 类型，对齐 `photos.json` 实际字段（`thumbnail` 单数、`thumbHash` camelCase）
- [x] **`GalleryWithViewer.tsx`** — 新建状态容器，整合 gallery + viewer + URL 同步
  -  `setState` 先于 `history.pushState` 执行（时序正确）
  -  `popstate` 监听器在 `useEffect` cleanup 中移除
  -  `isMounted` 防御，防止 SSR/CSR hydration 不一致
- [x] **`MasonicGallery.tsx`** — `PhotoCard` 改用 `onClick` 回调替代 `<a>` 整页跳转
  -  保留隐藏 `<a href>` 用于右键/中键在新标签打开
  -  onClick 触发时记录 `triggerRef`（触发元素），关闭时归还焦点
- [x] **`PhotoViewer.tsx`** — 新增胶片条，使用 `@tanstack/virtual` 虚拟化渲染
  -  虚拟化渲染，100+ 张照片仍流畅
  -  激活项自动居中滚动（`virtualizer.scrollToIndex`）
  -  视觉层级：激活 `scale(1.15)`，相邻 `scale(1.05)`，其余 `opacity-50 grayscale(30%)`
- [x] **`PhotoViewer.tsx`** — 缩放 & 平移手势
  -  滚轮缩放（以鼠标位置为中心）
  -  双击缩放（以点击位置为中心，300ms 时间差判断）
  -  双指捏合缩放
  -  缩放 <= 1 时自动 reset translate 到 (0, 0)
  -  原图 `onError` 时回退到缩略图展示
- [x] **`index.astro`** — 替换为 `GalleryWithViewer`，清理 ~200 行未使用 CSS
- [x] URL 同步：`history.pushState`/`replaceState` + `popstate` 监听，后退键正确关闭 viewer
- [x] 键盘焦点管理：关闭时归还焦点（用 `triggerRef` 记录触发元素）
- [x] **删除 `BlurHashImage.astro`** — 未被任何文件引用的冗余组件

### P1 — 重要

> **2026-10-13 起 P1/P2/P3 全部延后到 v2 重写完成后**；分享的 OG meta 实现方式也要改为 Worker `HTMLRewriter`（不再是 `[...slug].astro`）。

- [x] 标签系统（基于目录路径自动生成 + 搜索筛选）
  - `TagBrowser.tsx`：搜索栏 + 多选标签 + MasonicGallery + PhotoViewer
  - `/tags/` 页面：Astro SSG 读取 photos.json 提取标签
  - 侧边栏入口：Author.astro 添加"浏览标签"链接
  - `useDeferredValue` 优化搜索性能
  - 筛选变化时自动修正 viewer 索引

- [ ] 图片分享功能（Web Share API + OG meta）
  - 💡 OG `og:image` 必须是绝对 URL（含 `https://`），R2 CDN URL 可直接使用（见 AFILMORY_LEARNINGS §9）
  - 💡 OG meta 在 `[...slug].astro` 的 `<head>` 中设置（已有 SSG fallback 页面）

- [ ] 暗色模式

### P2 — 锦上添花

- [ ] 地图视图（Leaflet + EXIF GPS → GeoJSON）
  - 💡 简化替代方案：直接生成高德/Google Maps 链接（`https://maps.amap.com/?q=lat,lng`），无需引入地图库
  - 💡 GPS 展示前做坐标模糊化（精度降至小数点后 2 位）

- [ ] HEIC/TIFF 前端预览支持

- [ ] Live Photo 支持

- [ ] GPS 数据模糊化（隐私保护）

- [ ] AVIF 格式支持

### P3 — 探索性

- [ ] WebGL 特效
- [ ] HDR 支持
- [ ] 3D 相册
- [ ] AI 智能标签（Cloudinary AI）

## 第四阶段：优化与部署

### 性能优化
- [x] 虚拟滚动 — 胶片条已使用 `@tanstack/virtual` 实现虚拟化渲染
- [x] 构建增量缓存（基于 R2 ETag 内容哈希检测文件变更，跳过未变更图片）
- [ ] R2 持久化缓存（构建产物回传 R2，解决 CI 缓存丢失）
- [ ] Intersection Observer 预加载下一组图片
- [ ] PWA 支持离线查看
- [ ] 构建并行化（图片量 > 200 张时，用 Promise 并发控制替代串行处理，见 AFILMORY_LEARNINGS §10）

### 部署

> **2026-10-13：部署目标改为 Cloudflare Workers**，Netlify 方案作废（`netlify` 分支配置不再维护）。

- [x] Netlify 部署配置（netlify.toml）— 2026-09-08 上线，配置在 `netlify` 分支（**已被 v2 取代**）
  - 构建命令 `pnpm install && pnpm build:r2`（必须先装依赖，`tsx` 是 devDependency）
  - 双域名：站点 `gallery.echorains.top` / 图片 `photos.echorains.top`
  - 不要加 SPA/角色条件 `[[redirects]]`（会导致全站 404）
  - R2 密钥在 Netlify UI 用 key/value pairs 配置
- [ ] 决定是否提交 `pnpm-lock.yaml`（目前被 gitignore，Netlify 安装不可复现）
- [ ] 清理 `netlify.toml` 中意图不明的 `NPM_FLAGS = "--version"`
- [ ] CDN 缓存策略（图片/字体永久缓存，API 短期缓存）
- [ ] Lighthouse 性能调优（目标 >90 分）

### 构建产物收尾（2026-09-08 排序改动后续）
- [ ] 重跑 `process-images` / `process-images:r2`，生成按拍摄时间降序的 `photos.json`（排序代码已就位，产物尚未重生成）
- [ ] `src/lib/image/exif.ts` 补读 `OffsetTimeOriginal`，修正展示时区（见 AFILMORY_LEARNINGS §6）
  - 排序本身不受影响（偏移一致），但展示时间可能系统性偏移

### RSS & Sitemap
- [ ] RSS Feed 生成（item pubDate 用拍摄时间，非构建时间）
- [ ] Sitemap 生成（lastmod 用拍摄时间，非构建时间，见 AFILMORY_LEARNINGS §9）

## 技术栈

- [x] R2 构建忽略 `.thumbnails` 目录（避免缩略图被当作原图处理）
- [ ] 统一日志格式
- [ ] 构建脚本错误处理完善
- [ ] API 文档

## 技术债（2026-05-27 标签系统评审遗留）

- [ ] 抽取 photos.json 读取/解析公共工具（`index.astro` 与 `tags/index.astro` 重复实现）
- [ ] `JSON.parse` 失败的错误提示与「Photos not processed yet」区分（当前会误导）
- [ ] 移除 `.astro` 页面中的死导出 `export const title/description/pubDate`
- [ ] 搜索框 a11y：`aria-label` / `type="search"` / 清除按钮
- [ ] `closeViewer` 的 `setTimeout(100)` 增加卸载保护（可能在 unmount 后触发）
- [ ] 骨架屏 CSS grid 与真画廊 masonry 不一致，hydrate 时 CLS

> 验证门槛：本仓库 `tsc`/`astro check` 不可用（TypeScript 非直接依赖；`astro check` 非交互 shell 会卡住），一律用 `pnpm build` 验收。

---

## 性能目标

```yaml
Lighthouse:
  Performance: >90
  Accessibility: >95
  Best Practices: >95
  SEO: >95

核心指标:
  LCP: <2.5s
  FID: <100ms
  CLS: <0.1
```
