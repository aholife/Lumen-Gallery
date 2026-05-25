# 项目待办清单

> 基于开发计划四阶段 + 优先级排序，跟踪全局进度。
> 详细当前任务见 [CONTEXT.md](./CONTEXT.md)。

---

## 第一阶段：基础设施搭建 

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

- [ ] 标签系统（基于目录路径自动生成 `/tags/xxx`）
  - 💡 根目录下无子目录的图片使用 `uncategorized` 作为默认 tag（见 AFILMORY_LEARNINGS §8）
  - 💡 切换 tag 时给 masonic 组件加 `key={activeTag}`，强制重新计算布局
  - 💡 分组 header 显示日期范围，如"2024年3月 · 12张"

- [ ] 图片分享功能（Web Share API + OG meta）
  - 💡 OG `og:image` 必须是绝对 URL（含 `https://`），R2 CDN URL 可直接使用（见 AFILMORY_LEARNINGS §9）
  - 💡 OG meta 在 `[...slug].astro` 的 `<head>` 中设置（已有 SSG fallback 页面）

- [ ] 暗色模式

- [ ] 多尺寸缩略图支持（300w/800w/1600w）

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
- [ ] Netlify 部署配置（netlify.toml）
- [ ] CDN 缓存策略（图片/字体永久缓存，API 短期缓存）
- [ ] Lighthouse 性能调优（目标 >90 分）

### RSS & Sitemap
- [ ] RSS Feed 生成（item pubDate 用拍摄时间，非构建时间）
- [ ] Sitemap 生成（lastmod 用拍摄时间，非构建时间，见 AFILMORY_LEARNINGS §9）

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
