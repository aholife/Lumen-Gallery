# Lumen Gallery 项目总结

> 创建时间：2026-04-28
> 最后更新：2026-05-27
> 基于 docs 目录文档分析

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

### P1 — 重要功能
- ✅ **标签系统**（已完成 2026-05-27）
  - 独立标签浏览页面（`/tags/`）
  - 搜索栏：匹配标签名、文件名、相机、镜头等 EXIF 元数据
  - 多选标签筛选（OR 逻辑），搜索与标签取交集（AND）
  - 复用 `MasonicGallery` + `PhotoViewer`
  - `useDeferredValue` 优化搜索性能
- 图片分享（Web Share API + OG meta）
- 暗色模式

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
7. 输出 `photos.json` 元数据清单
8. 上传缩略图到 R2

### 前端架构
- **Astro SSG**: 静态页面生成，SEO 友好
- **React Islands**: 复杂交互组件（`client:only="react"`）
  - `GalleryWithViewer.tsx` — 状态容器 + URL 同步
  - `MasonicGallery.tsx` — 瀑布流画廊（onClick 回调模式）
  - `PhotoViewer.tsx` — 图片查看器（胶片条 + 缩放 + 键盘导航）
  - `TagBrowser.tsx` — 标签浏览（搜索 + 多选筛选 + 画廊）

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

### ✅ 结论：继续使用 Astro + React Islands

Viewer Overlay 改造已成功在 Astro 架构下实现，验证了以下方案的可行性：
- `client:only="react"` island 模式足以支撑复杂交互
- `history.pushState` + `popstate` 实现 URL 同步，无需路由库
- `[...slug].astro` SSG 页面保留直链/SEO 兜底
- 状态复杂度可控，暂不需要 Zustand

### 未来迁移 Next.js 的触发条件
如果未来出现以下需求，可重新评估迁移：
- 需要用户上传功能（API Routes 更方便）
- 需要 React Server Components 优化首屏性能
- 团队规模扩大，需要统一的全栈框架

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

---

## ✅ 总结

**当前状态**: Astro 架构在 Viewer Overlay 改造中遇到瓶颈，SSR/CSR hydration 和状态管理复杂度高。

**推荐方案**: 迁移到 **Next.js 14 App Router**，理由：
1. 原生 React 支持，简化状态管理
2. 内置图片优化，减少手动处理
3. API Routes 支持实时上传和处理
4. 更好的性能和开发体验
5. 成熟的生态和社区支持

**迁移成本**: 约 1-2 周（基础迁移 + 核心功能），可渐进式迁移。

**风险**: 学习曲线（如果团队不熟悉 Next.js），但长期收益大于成本。
