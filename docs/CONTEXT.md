# 当前开发上下文

> 最后更新：2026-04-24
> 当前焦点模块：前端展示层（GalleryWithViewer Overlay 改造）

## 🎯 目标

完成 Viewer Overlay 改造（P0+），实现不刷新页面的图片查看体验，对标 Afilmory，达到 MVP 可部署状态。

## 📌 项目概况

- **项目名称**: Lumen Gallery
- **核心技术**: Astro + TypeScript + Tailwind CSS + React（复杂交互组件）
- **存储方案**: Cloudflare R2（主要）/ Local / GitHub（可切换）
- **图片处理**: Sharp（格式转换/缩略图）+ exifr（EXIF）+ thumbhash（占位符）
- **当前阶段**: Viewer Overlay 改造中（详见 [PLAN-viewer-overlay.md](./plan/PLAN-viewer-overlay.md)）

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

### 前端页面
- [x] 基础布局组件（Header, Footer）
- [x] 博客功能（基于 Astro Content Collections）
- [x] 画廊数据源接入
- [x] 响应式瀑布流画廊（MasonicGallery）
- [x] ThumbHash 懒加载占位符
- [x] 图片详情/全屏查看器（PhotoViewer overlay）
- [x] EXIF 信息展示面板

## 🕒 进行中

- [ ] **Viewer Overlay 改造** — `GalleryWithViewer.tsx`
  - PhotoCard 改用 onClick 替代整页跳转
  - URL 同步（`history.pushState` + `popstate` 监听）
  - 胶片条虚拟化渲染（`@tanstack/virtual`）
  - 键盘焦点管理（Focus Trap）

## ⏳ 待办（Next）

- [ ] 标签系统（基于目录路径自动生成 `/tags/xxx`）
- [ ] 图片分享功能（Web Share API + OG meta）
- [ ] 地图视图（EXIF GPS 数据）
- [ ] 暗色模式
- [ ] 性能优化（虚拟���动、构建缓存）

## 🔑 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 主存储 | Cloudflare R2 | 零出口流量费，S3 兼容 API |
| 占位符 | ThumbHash（非 BlurHash） | 体积更小、质量更高、支持透明度 |
| 缩略图格式 | WebP | 更高效压缩，更好质量 |
| 缩略图策略 | 单张 800w | 简化流程，满足当前需求 |
| WebGL 渲染 | 暂不使用 | 增加 200KB+ JS，收益不明显 |
| 全屏查看转场 | Overlay + URL 同步 | 不跳页，体验更好；直链 fallback 保留 SEO |
| 状态管理 | Zustand（viewer 复杂后引入） | 避免 viewer+gallery+URL 三方状态 prop drilling |

## 📌 注意事项

### 构建 / 脚本
- Node/tsx 脚本不支持 `import.meta.env`，需用 `dotenv/config` 加载环境变量
- R2 兼容性需配置 `requestChecksumCalculation` 和 `responseChecksumValidation`
- R2 中 `size=0` 的对象为目录标记，需在文件列表阶段过滤
- R2 构建默认忽略 `.thumbnails` 目录，可通过 `R2_IGNORE_DIRS` 环境变量追加其他忽略目录

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
| `src/components/GalleryWithViewer.tsx` | Viewer Overlay 状态容器（待新建） |
| `src/components/MasonicGallery.tsx` | 瀑布流画廊组件 |
| `src/components/PhotoViewer.tsx` | 图片查看器（含胶片条，待改造） |
| `src/pages/index.astro` | 首页（待替换为 GalleryWithViewer） |
| `src/pages/Gallery/[...slug].astro` | 画廊 fallback 页面（直链/SEO 兜底） |
| `public/photos.json` | 构建产物 — 图片元数据清单 |
| `docs/AFILMORY_LEARNINGS.md` | Afilmory 参考手册（防坑指南） |
