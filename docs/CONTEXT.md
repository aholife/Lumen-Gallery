# 当前开发上下文

> 最后更新：2026-03-31
> 当前焦点模块：前端展示层（Gallery 组件）

## 🎯 目标

完成核心展示层开发，实现高性能响应式瀑布流画廊、图片详情查看器，达到 MVP 可部署状态。

## 📌 项目概况

- **项目名称**: Lumen Gallery
- **核心技术**: Astro + TypeScript + Tailwind CSS + React（复杂交互组件）
- **存储方案**: Cloudflare R2（主要）/ Local / GitHub（可切换）
- **图片处理**: Sharp（格式转换/缩略图）+ exifr（EXIF）+ thumbhash（占位符）
- **当前阶段**: 基础设施与图片处理流水线已完成，前端展示组件开发中

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

### 前端页面
- [x] 基础布局组件（Header, Footer）
- [x] 博客功能（基于 Astro Content Collections）
- [x] 画廊数据源接入

## 🕒 进行中

- [x] **响应式瀑布流画廊** — `src/components/MasonicGallery.tsx`
  - 实现高性能、自适应的图片瀑布流布局
  - 已有基础框架，需完善交互和性能

## ⏳ 待办（Next）

- [x] **图片详情/全屏查看器**
    - *状态*: 已完成
    - *功能*: 手势缩放、鼠标滚轮缩放、上下张导航、胶片条快速选择、EXIF 信息展示面板、键盘快捷键。
- [ ] EXIF 信息展示面板
- [ ] 图片分享功能
- [ ] 地图视图（EXIF GPS 数据）
- [ ] 性能优化（虚拟滚动、构建缓存）

## 🔑 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 主存储 | Cloudflare R2 | 零出口流量费，S3 兼容 API |
| 占位符 | ThumbHash（非 BlurHash） | 体积更小、质量更高、支持透明度 |
| 缩略图格式 | WebP | 更高效压缩，更好质量 |
| 缩略图策略 | 单张 800w | 简化流程，满足当前需求 |
| WebGL 渲染 | 暂不使用 | 增加 200KB+ JS，收益不明显 |
| 全屏查看转场 | Astro View Transitions | 原生级平滑过渡，无需复杂 JS |

## 📌 注意事项

- Node/tsx 脚本不支持 `import.meta.env`，需用 `dotenv/config` 加载环境变量
- R2 兼容性需配置 `requestChecksumCalculation` 和 `responseChecksumValidation`
- `sharp.rotate()` 自动根据 EXIF Orientation 旋转，`getImageDimensions()` 需考虑旋转后尺寸
- GPS 数据展示需做模糊化处理以保护隐私
- R2 构建默认忽略 `.thumbnails` 目录，可通过 `R2_IGNORE_DIRS` 环境变量追加其他忽略目录

## 📂 关键文件索引

| 文件 | 用途 |
|------|------|
| `src/lib/storage/` | 统一存储接口（Local/R2/GitHub） |
| `src/lib/image/` | 图片处理（EXIF/缩略图/ThumbHash） |
| `scripts/build-images-r2.ts` | R2 模式构建脚本 |
| `scripts/build-images.ts` | 本地模式构建脚本 |
| `src/components/MasonicGallery.tsx` | 瀑布流画廊组件 |
| `src/pages/Gallery/[...slug].astro` | 画廊页面路由 |
| `public/photos.json` | 构建产物 — 图片元数据清单 |
