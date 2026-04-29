# Lumen Gallery 项目总结与框架建议

> 创建时间：2026-04-28  
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
- ✅ 响应式瀑布流画廊（Masonry Layout）
- ✅ 图片处理流水线（格式转换、缩略图生成、EXIF 提取、ThumbHash 占位符）
- ✅ R2 全托管存储（原图 + 缩略图）
- ✅ 增量构建（基于 ETag 检测变更）
- 🔄 **Viewer Overlay 改造**（当前重点）
  - 不刷新页面的图片查看体验
  - URL 同步（可分享直链）
  - 胶片条虚拟化渲染
  - 键盘/手势交互

### P1 — 重要功能
- 标签系统（基于目录结构自动生成）
- 图片分享（Web Share API + OG meta）
- 暗色模式
- 多尺寸缩略图支持（300w/800w/1600w）

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
  - `MasonicGallery.tsx` — 瀑布流画廊
  - `PhotoViewer.tsx` — 图片查看器
  - `GalleryWithViewer.tsx` — 状态容器（待实现）

---

## ⚠️ 当前架构的痛点

### 1. SSR/CSR Hydration 复杂性
- Astro Islands 需要 `client:only="react"` 避免 hydration 不一致
- 需要额外的 `isMounted` 防御逻辑
- React 状态管理跨 island 困难

### 2. URL 同步与状态管理
- Viewer + Gallery + URL 三方状态耦合
- `history.pushState` 与 React 状态时序敏感
- 需要手动管理 `popstate` 监听器清理

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

## 🔄 迁移方案

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

## 🎯 推荐决策

### ✅ 推荐：迁移到 Next.js 14

**理由**:
1. 项目核心是**交互式照片画廊**，React 占比 > 70%，Astro 的静态生成优势未充分利用
2. Viewer Overlay 改造需要复杂的状态管理，Next.js 更适合
3. 未来需要用户上传功能，Next.js 的 API Routes 更方便
4. `next/image` 可大幅简化图片处理流程
5. 更好的开发体验和社区支持

### ⚠️ 保留 Astro 的场景
如果项目满足以下条件，可以继续使用 Astro：
- 纯静态展示，无复杂交互
- 不需要用户上传功能
- 构建脚本可以接受
- 团队熟悉 Astro 生态

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
| **框架** | Next.js 14 App Router | 更适合交互式应用，原生 React 支持 |
| **图片优化** | next/image + Sharp | 内置优化 + 自定义处理 |
| **状态管理** | Zustand | 轻量、简单、TypeScript 友好 |
| **Viewer 实现** | Parallel Routes | 原生 Modal Overlay 支持 |
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
