# 项目待办清单

> 基于开发计划四阶段 + 优先级排序，跟踪全局进度。
> 详细当前任务见 [CONTEXT.md](./CONTEXT.md)。

---

## 第一阶段：基础设施搭建 ✅

- [x] Astro + TypeScript + Tailwind CSS 初始化
- [x] 目录结构设计
- [x] 多存储抽象层实现（LocalStorage / R2Storage / GitHubStorage）
- [x] 环境变量配置（.env + dotenv 兼容）
- [x] R2 S3 兼容配置（checksumCalculation 兼容性修复）

## 第二阶段：图像处理流水线 ✅

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

- [ ] **`GalleryWithViewer.tsx`** — 新建状态容器，整合 gallery + viewer + URL 同步
- [ ] **`MasonicGallery.tsx`** — `PhotoCard` 改用 `onClick` 回调替代 `<a>` 整页跳转
- [ ] **`PhotoViewer.tsx`** — 新增胶片条组件，使用 `@tanstack/virtual` 虚拟化渲染，激活项自动居中滚动，优化视觉层级动效
- [ ] **`PhotoViewer.tsx`** — 统一 `Photo` 类型（对齐 `photos.json` 实际字段 `thumbnail` 单数）
- [ ] **`index.astro`** — 替换为 `GalleryWithViewer`
- [ ] URL 同步：`history.pushState`/`replaceState` + `popstate` 监听，后退键正确关闭 viewer
- [ ] 键盘焦点管理：viewer 开启时 focus trap，关闭时归还焦点

### P1 — 重要

- [ ] 标签系统（基于目录路径自动生成 `/tags/xxx`）
- [ ] 图片分享功能（Web Share API + OG meta）
- [ ] 暗色模式
- [ ] 多尺寸缩略图支持（300w/800w/1600w）

### P2 — 锦上添花

- [ ] 地图视图（Leaflet + EXIF GPS → GeoJSON）
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
- [ ] 虚拟滚动（@tanstack/virtual）
- [x] 构建增量缓存（基于 R2 ETag 内容哈希检测文件变更，跳过未变更图片）
- [ ] R2 持久化缓存（构建产物回传 R2，解决 CI 缓存丢失）
- [ ] Intersection Observer 预加载下一组图片
- [ ] PWA 支持离线查看

### 部署
- [ ] Netlify 部署配置（netlify.toml）
- [ ] CDN 缓存策略（图片/字体永久缓存，API 短期缓存）
- [ ] Lighthouse 性能调优（目标 >90 分）

## 技术栈

- [x] R2 构建忽略 `.thumbnails` 目录（避免缩略图被当作原图处理）
- [ ] 统一日志格式
- [ ] 构建脚本错误处理完善
- [ ] API 文档

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
