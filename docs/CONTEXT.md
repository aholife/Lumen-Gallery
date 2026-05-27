# 当前开发上下文

> 最后更新：2026-05-27
> 当前焦点模块：第三阶段 P1 功能开发（分享 / 暗色模式）

## 🎯 目标

Viewer Overlay 改造已完成，MVP 可部署。下一步：P1 功能（标签系统、图片分享、暗色模式、多尺寸缩略图）。

## 📌 项目概况

- **项目名称**: Lumen Gallery
- **核心技术**: Astro + TypeScript + Tailwind CSS + React（复杂交互组件）
- **存储方案**: Cloudflare R2（主要）/ Local / GitHub（可切换）
- **图片处理**: Sharp（格式转换/缩略图）+ exifr（EXIF）+ thumbhash（占位符）
- **当前阶段**: Viewer Overlay 已完成，进入 P1 功能开发

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

## ⏳ 待办（Next）

- [ ] 图片分享功能（Web Share API + OG meta）
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
| 状态管理 | useState + history API | 当前复杂度可控，暂不引入 Zustand |
| 标签页面 | 独立 /tags/ 页面 | 不改变首页布局，标签+搜索功能独立 |

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
| `src/types/photo.ts` | 共享 Photo 类型定义（对齐 photos.json） |
| `src/components/GalleryWithViewer.tsx` | Viewer Overlay 状态容器 + URL 同步 |
| `src/components/MasonicGallery.tsx` | 瀑布流画廊组件（onClick 回调模式） |
| `src/components/PhotoViewer.tsx` | 图片查看器（胶片条 + 缩放 + 键盘导航） |
| `src/components/TagBrowser.tsx` | 标签浏览（搜索 + 多选筛选 + 画廊） |
| `src/pages/index.astro` | 首页（使用 GalleryWithViewer） |
| `src/pages/tags/index.astro` | 标签浏览页面 |
| `src/pages/Gallery/[...slug].astro` | 画廊 fallback 页面（直链/SEO 兜底） |
| `public/photos.json` | 构建产物 — 图片元数据清单 |
| `docs/AFILMORY_LEARNINGS.md` | Afilmory 参考手册（防坑指南） |
