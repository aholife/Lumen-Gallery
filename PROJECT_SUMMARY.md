# Lumen Gallery 项目总结

> 创建时间：2026-04-28
> 最后更新：2026-10-13
> 基于 docs 目录文档与 .specstory 会话历史整理

---

## 📋 项目概况

**项目名称**: Lumen Gallery  
**项目类型**: 个人照片画廊 Web 应用  
**当前技术栈**: Astro + TypeScript + Tailwind CSS + React Islands  
**存储方案**: Cloudflare R2（主要）/ Local / GitHub（可切换）

---

## 🎯 核心功能需求

### P0 — 必须完成（MVP）
-  响应式瀑布流画廊（Masonry Layout）
-  图片处理流水线（格式转换、缩略图生成、EXIF 提取、ThumbHash 占位符）
-  R2 全托管存储（原图 + 缩略图）
-  增量构建（基于 ETag 检测变更）
- ✅ **Viewer Overlay 改造**（已完成 2026-05-25）
  - 不刷新页面的图片查看体验（`GalleryWithViewer` 状态容器）
  - URL 同步（`history.pushState` + `popstate`，可分享直链）
  - 胶片条虚拟化渲染（`@tanstack/virtual`）
  - 键盘/手势交互（滚轮/双击/双指缩放、拖拽平移）
- ✅ **照片排序**（已完成 2026-09-08）— 构建时按拍摄时间降序写入 `photos.json`
- ✅ **Netlify 部署**（已完成 2026-09-08）— `netlify` 分支 + R2 模式 + 双域名

### P1 — 重要功能
- ✅ **标签系统**（已完成 2026-05-27）
  - 独立标签浏览页面（`/tags/`）
  - 搜索栏：匹配标签名、文件名、相机、镜头等 EXIF 元数据
  - 多选标签筛选（OR 逻辑），搜索与标签取交集（AND）
  - 复用 `MasonicGallery` + `PhotoViewer`
  - `useDeferredValue` 优化搜索性能
- 图片分享（Web Share API + OG meta）
- 暗色模式
- ~~多尺寸缩略图（300w/800w/1600w）~~ — **已取消**（2026-05-27 用户决定），长期维持单张 800w WebP

### P2 — 增强功能
- 地图视图（基于 EXIF GPS）
- HEIC/TIFF 前端预览
- Live Photo 支持
- GPS 数据模糊化（隐私保护）

---

## 🏗️ 当前架构

### 存储架构
```
R2 Bucket/
├── photos/         # 原图（用户上传）
└── .thumbnails/    # 缩略图（构建时生成）

本地仓库/
└── public/photos.json  # 元数据清单（唯一构建产物）
```

### 图片处理流程
1. 扫描 R2 存储桶中的原图
2. 格式转换（HEIC/TIFF → JPEG）
3. 生成 WebP 缩略图（800w，自动旋转）
4. 提取 EXIF 元数据（相机、GPS、拍摄参数）
5. 生成 ThumbHash 占位符
6. 基于目录结构生成标签
7. **按 `exif.dateTime` 降序排序**（最新在前；无 EXIF 日期的排最后）
8. 输出 `photos.json` 元数据清单
9. 上传缩略图到 R2

> `photos.json` 的数组顺序即前端展示顺序（画廊、查看器胶片条、上下张导航共用），前端不做排序。

### 前端架构
- **Astro SSG**: 静态页面生成，SEO 友好
- **React Islands**: 复杂交互组件（`client:only="react"`）
  - `GalleryWithViewer.tsx` — 状态容器 + URL 同步
  - `MasonicGallery.tsx` — 瀑布流画廊（onClick 回调模式）
  - `PhotoViewer.tsx` — 图片查看器（胶片条 + 缩放 + 键盘导航）
  - `TagBrowser.tsx` — 标签浏览（搜索 + 多选筛选 + 画廊）

### 部署架构（2026-09-08 上线）
```
netlify 分支（部署配置）
├── netlify.toml        # command = "pnpm install && pnpm build:r2"
└── astro.config.mjs    # site = https://gallery.echorains.top

dev / master 分支（业务代码，不含部署配置）

Netlify 构建时：安装依赖 → R2 下载原图 → 生成缩略图并回传 R2
             → 写出 photos.json（按拍摄时间降序）→ astro build → dist/

双域名：
├── gallery.echorains.top  # 站点（SEO/OG 绝对 URL）
└── photos.echorains.top   # 图片 CDN（R2_PUBLIC_URL）
```

---

## ⚠️ 当前架构的已知约束

### 1. SSR/CSR Hydration 复杂性（已解决）
- Astro Islands 使用 `client:only="react"` 避免 hydration 不一致
- `isMounted` 防御逻辑已在 `GalleryWithViewer` 中处理

### 2. URL 同步与状态管理（已解决）
- `GalleryWithViewer` 通过 `history.pushState` + `popstate` 实现 URL 同步
- 时序：`setState` 先于 `pushState` 执行，避免竞争

### 3. 图片处理流程分离
- 构建脚本与前端分离，需要手动运行
- 无法实时处理用户上传的图片
- 增量构建依赖外部脚本

### 4. 性能优化受限
- Astro 的静态生成模式限制了动态优化能力
- 无法利用 React Server Components
- 图片优化需要自定义 Sharp 流程

---

## 🚀 框架建议：Next.js 14+ (App Router)

### 为什么选择 Next.js？

#### 1. **原生 React 支持**
- 无需 Islands 架构，全栈 React 应用
- 简化状态管理（Zustand/Context 跨组件无障碍）
- 避免 SSR/CSR hydration 复杂性

#### 2. **内置图片优化**
```tsx
import Image from 'next/image'

<Image
  src={photo.thumbnail}
  alt={photo.title}
  width={800}
  height={600}
  placeholder="blur"
  blurDataURL={thumbHashToDataURL(photo.thumbHash)}
  loading="lazy"
/>
```
- 自动响应式图片（srcset）
- 内置懒加载和占位符
- 自动格式转换（WebP/AVIF）
- 减少 Sharp 手动处理

#### 3. **API Routes + Server Actions**
```tsx
// app/api/upload/route.ts
export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file')
  
  // 直接处理上传、生成缩略图、上传 R2
  const metadata = await processImage(file)
  return Response.json(metadata)
}

// app/actions/process-images.ts
'use server'
export async function processImages() {
  // 增量构建逻辑，可在后台运行
}
```
- 无需独立构建脚本
- 实时处理用户上传
- 统一的 TypeScript 类型

#### 4. **React Server Components (RSC)**
```tsx
// app/page.tsx (Server Component)
async function getPhotos() {
  const photos = await fetch('https://r2.example.com/photos.json')
  return photos.json()
}

export default async function HomePage() {
  const photos = await getPhotos()
  return <GalleryWithViewer photos={photos} /> // Client Component
}
```
- 服务端数据获取，零客户端 JS
- 自动代码分割
- 更好的 SEO 和首屏性能

#### 5. **文件系统路由**
```
app/
├── page.tsx                    # 首页画廊
├── gallery/[slug]/page.tsx     # 图片详情（SEO fallback）
├── tags/[tag]/page.tsx         # 标签筛选
└── api/
    ├── upload/route.ts         # 图片上传
    └── process/route.ts        # 增量构建触发
```
- 清晰的路由结构
- 动态路由原生支持
- Parallel Routes 支持 Modal Overlay

#### 6. **性能优化**
- **Streaming SSR**: 渐进式渲染，首屏更快
- **Partial Prerendering (PPR)**: 静态 + 动态混合
- **自动代码分割**: 按路由自动分割
- **内置缓存**: `fetch` 自动缓存，`revalidate` 控制

---

## 🔄 Next.js 迁移方案（仅供参考，当前不迁移）

> Viewer Overlay 已在 Astro 下成功实现，以下方案仅作为未来参考。

### 阶段 1：基础迁移（1-2 天）
1. 初始化 Next.js 14 项目（App Router）
2. 迁移 Tailwind CSS 配置
3. 迁移 TypeScript 类型定义
4. 迁移存储适配器（R2/Local/GitHub）

### 阶段 2：核心功能（3-5 天）
1. 实现画廊页面（Server Component + Client Component）
2. 迁移 `MasonicGallery` 组件
3. 实现 Viewer Overlay（使用 Parallel Routes）
4. URL 同步与状态管理（Zustand）

### 阶段 3：图片处理（2-3 天）
1. 实现 API Routes（上传、处理、增量构建）
2. 集成 `next/image` 优化
3. 迁移 EXIF/ThumbHash 处理逻辑
4. 实现后台任务队列（可选：BullMQ）

### 阶段 4：增强功能（按需）
1. 标签系统
2. 分享功能（OG meta）
3. 地图视图
4. 暗色模式

---

## 📊 技术对比

| 特性 | Astro + React Islands | Next.js 14 App Router |
|------|----------------------|----------------------|
| **React 集成** | Islands 架构，需 `client:only` | 原生全栈 React |
| **状态管理** | 跨 island 困难 | 无缝跨组件 |
| **图片优化** | 手动 Sharp 流程 | 内置 `next/image` |
| **API 支持** | 需要独立脚本 | API Routes + Server Actions |
| **SSR/CSR** | Hydration 复杂 | 自动处理 |
| **性能** | 静态生成快 | Streaming SSR + RSC 更优 |
| **开发体验** | 学习曲线陡峭 | 成熟生态，文档完善 |
| **部署** | 静态托管（Netlify/Vercel） | Vercel 原生支持 |

---

## 🎯 框架决策

### ✅ 结论（2026-10-13 更新）：完整重写为 Vite + React SPA，部署 Cloudflare Workers

> **本节已更新。** 2026-05-25 曾决定「继续 Astro + React Islands，暂不迁移 Next.js」。
> 2026-10-13 因体验差距（详情页渐进加载、标签筛选动画、手机双列、EXIF 布局）与部署目标变更（Netlify → Cloudflare Workers），
> 决定**完整 React 重写**。完整设计见 [`docs/superpowers/specs/2026-10-13-react-rewrite-workers-design.md`](docs/superpowers/specs/2026-10-13-react-rewrite-workers-design.md)。

**新架构：** Vite + React 19 + react-router v7 + Zustand + motion/GSAP Flip + **WebGL/WebGPU 渲染面** + Tailwind v4
**部署：** Cloudflare Workers Static Assets（与 R2 同生态）
**复用：** `src/lib/**`（存储 + 图片流水线）、`scripts/build-images*.ts`、`photos.json` 契约

**推翻的旧决策：**
- ~~继续 Astro + React Islands~~（2026-05-25）
- ~~Netlify 部署~~（2026-09-08）
- ~~暂不引入 Zustand~~
- ~~不使用 WebGL 渲染器~~（2026-02-10 → 2026-10-13 启用，移植 Afilmory `webgl-viewer`）

**仍然有效的旧决策：**
- 单张 800w WebP 缩略图（多尺寸已于 2026-05-27 取消）— Afilmory 的渐进阶梯也不需要多尺寸
- ThumbHash 占位符
- 构建时按 `exif.dateTime` 降序
- Cloudflare R2 主存储

### ~~历史结论：继续使用 Astro + React Islands~~（已被 2026-10-13 取代）

<details>
<summary>展开查看历史分析</summary>

Viewer Overlay 改造已成功在 Astro 架构下实现，验证了以下方案的可行性：
- `client:only="react"` island 模式足以支撑复杂交互
- `history.pushState` + `popstate` 实现 URL 同步，无需路由库
- `[...slug].astro` SSG 页面保留直链/SEO 兜底
- 状态复杂度可控，暂不需要 Zustand

</details>

---

## 📝 Next.js 实现示例

### Viewer Overlay（使用 Parallel Routes）

```tsx
// app/layout.tsx
export default function RootLayout({ children, modal }) {
  return (
    <html>
      <body>
        {children}
        {modal}
      </body>
    </html>
  )
}

// app/@modal/(.)gallery/[slug]/page.tsx
export default function PhotoModal({ params }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90">
      <PhotoViewer slug={params.slug} />
    </div>
  )
}

// app/gallery/[slug]/page.tsx (SEO fallback)
export default function PhotoPage({ params }) {
  return <PhotoViewer slug={params.slug} />
}
```

### 图片上传 + 处理

```tsx
// app/actions/upload.ts
'use server'
export async function uploadPhoto(formData: FormData) {
  const file = formData.get('file') as File
  const buffer = Buffer.from(await file.arrayBuffer())
  
  // 1. 上传原图到 R2
  await r2.putObject({
    Key: `photos/${file.name}`,
    Body: buffer,
  })
  
  // 2. 生成缩略图
  const thumbnail = await sharp(buffer)
    .resize(800)
    .webp({ quality: 85 })
    .toBuffer()
  
  // 3. 上传缩略图
  await r2.putObject({
    Key: `.thumbnails/${file.name}.webp`,
    Body: thumbnail,
  })
  
  // 4. 提取 EXIF
  const exif = await exifr.parse(buffer)
  
  // 5. 生成 ThumbHash
  const thumbHash = await generateThumbHash(buffer)
  
  // 6. 更新 photos.json
  await updatePhotosJson({ file.name, exif, thumbHash })
  
  revalidatePath('/')
}
```

---

## 🔗 参考资源

- [Next.js 14 文档](https://nextjs.org/docs)
- [Parallel Routes](https://nextjs.org/docs/app/building-your-application/routing/parallel-routes)
- [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [next/image 优化](https://nextjs.org/docs/app/building-your-application/optimizing/images)
- [Afilmory 参考实现](https://github.com/Afilmory/afilmory)

---

## 📌 关键决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| **框架** | Astro + React Islands | Viewer Overlay 已验证可行，静态生成 + 交互 island 模式 |
| **图片优化** | Sharp 自定义流程 | R2 全托管模式，构建时生成缩略图 |
| **状态管理** | useState + history API | 当前复杂度可控，暂不引入 Zustand |
| **Viewer 实现** | Overlay + URL 同步 | `GalleryWithViewer` 状态容器 + `history.pushState` |
| **存储** | Cloudflare R2（保持不变） | 零出口流量费，S3 兼容 |
| **占位符** | ThumbHash（保持不变） | 体积小、质量高 |
| **缩略图格式** | WebP（保持不变） | 高效压缩 |
| **缩略图尺寸** | 单张 800w（多尺寸已取消 2026-05-27） | 简化构建与存储 |
| **标签页面** | 独立 `/tags/` 页面 | 不改首页布局，标签 + 搜索独立 |
| **照片排序** | 构建时按 `exif.dateTime` 降序 | 前端零改动，全链路顺序一致 |
| **部署** | Netlify + 独立 `netlify` 分支 | 配置隔离；R2 模式在构建时生成元数据 |

---

## ✅ 总结

**当前状态（2026-10-13）**: Astro 架构已跑通完整链路并上线过 Netlify，但与 Afilmory 体验差距过大。已决定**完整 React 重写**，部署迁移 **Cloudflare Workers**。

**框架结论**: **Vite + React 19 SPA + react-router v7**（对齐 Afilmory），状态用 Zustand，动画用 motion + GSAP Flip，查看器用 **WebGPU/WebGL 渲染面**（LOD 放大不糊）。构建流水线 / R2 存储 / `photos.json` 契约原样复用。

**下一步**: 按 v2 设计文档分 7 个 Phase 实施（脚手架 → 画廊 → 渐进加载 → **WebGL 渲染面** → EXIF 面板 → 标签动画 → 收尾）。
详见 `docs/superpowers/specs/2026-10-13-react-rewrite-workers-design.md` 与 `docs/TODO.md`。
