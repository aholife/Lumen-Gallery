# Afilmory 开发日志参考手册

> 整理自 [Afilmory/afilmory](https://github.com/Afilmory/afilmory) 的 `.specstory/history` 开发日志（100+ 条）。
> 聚焦对 Lumen Gallery 当前及后续开发最有参考价值的功能点与防坑指南。
> 最后更新：2026-04-24

---

## 目录

1. [Viewer Overlay — 状态管理 & URL 同步](#1-viewer-overlay--状态管理--url-同步)
2. [胶片条虚拟化渲染](#2-胶片条虚拟化渲染)
3. [图片缩放 & 平移手势](#3-图片缩放--平移手势)
4. [ThumbHash 占位符过渡 & 加载降级](#4-thumbhash-占位符过渡--加载降级)
5. [事件监听器清理规范](#5-事件监听器清理规范)
6. [EXIF 数据处理细节](#6-exif-数据处理细节)
7. [iOS Safari 兼容性](#7-ios-safari-兼容性)
8. [标签系统 & 照片分组](#8-标签系统--照片分组)
9. [OG 图片 & RSS & Sitemap](#9-og-图片--rss--sitemap)
10. [构建脚本 & R2 优化](#10-构建脚本--r2-优化)
11. [移动端 UI 适配](#11-移动端-ui-适配)
12. [防坑清单（速查）](#12-防坑清单速查)

---

## 1. Viewer Overlay — 状态管理 & URL 同步

**参考日志**：`2025-05-25_05-28`（Zustand 状态管理）、`2025-05-31_13-06`（Tags 筛选状态）

### URL 同步时序

`history.pushState` 必须发生在 `setState` **之后**，否则 React 状态与 URL 之间产生竞争条件：`popstate` 事件触发时 React 状态尚未更新，导致 viewer 无法正确打开/关闭。

```tsx
//  正确顺序
const openViewer = (photo: Photo, index: number) => {
  setCurrentIndex(index)                              // 1. 先更新 React 状态
  history.pushState({}, '', '/Gallery/' + photo.key) // 2. 再写入 URL
}

const closeViewer = () => {
  setCurrentIndex(null) // 1. 先清空状态
  history.back()        // 2. 再触发 popstate
}

// popstate 监听：处理浏览器前进/后退
useEffect(() => {
  const handler = () => {
    const slug = location.pathname.replace('/Gallery/', '')
    const idx = photos.findIndex(p => p.key === slug)
    setCurrentIndex(idx >= 0 ? idx : null)
  }
  window.addEventListener('popstate', handler)
  return () => window.removeEventListener('popstate', handler) // ⚠️ 必须清理
}, [photos])
```

### Zustand vs useState

Viewer + Gallery + URL 三个状态相互耦合，推荐提前引入 Zustand 替代多层 `useState` prop drilling。Afilmory 专门为此做了一次重构，事后认为"应该一开始就用 Zustand"。

```tsx
// store/gallery.ts
import { create } from 'zustand'

interface GalleryStore {
  currentIndex: number | null
  setCurrentIndex: (idx: number | null) => void
}

export const useGalleryStore = create<GalleryStore>(set => ({
  currentIndex: null,
  setCurrentIndex: idx => set({ currentIndex: idx }),
}))
```

### SSR Hydration 防御

`GalleryWithViewer` 是 `client:only="react"` island，但仍需防止 SSR/CSR 不一致：

```tsx
const [isMounted, setIsMounted] = useState(false)
useEffect(() => setIsMounted(true), [])

if (!isMounted) return <GallerySkeletonSSR /> // 服务端渲染骨架
```

---

## 2. 胶片条虚拟化渲染

**参考日志**：`2025-05-26_07-31`（手机适配）、`2025-05-30_13-33`（masonic item 动画）

### 为什么必须虚拟化

照片数量必然超过 100 张，非虚拟化的胶片条会导致：
- 全部缩略图 DOM 同时挂载，首次渲染卡顿
- 内存中保持大量 `<img>` 节点

### @tanstack/virtual 实现

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

const filmstripRef = useRef<HTMLDivElement>(null)

const virtualizer = useVirtualizer({
  count: photos.length,
  getScrollElement: () => filmstripRef.current,
  estimateSize: () => 76,   // item 宽度 + gap（px）
  horizontal: true,
  overscan: 5,              // 两侧各预渲染 5 个
})
```

### 激活项自动居中滚动

`scrollIntoView` 在 iOS Safari 上有兼容性问题，推荐手动计算偏移量：

```tsx
useEffect(() => {
  if (currentIndex === null || !filmstripRef.current) return

  // 方案一：scrollIntoView（Chrome/Firefox 可用）
  const activeEl = filmstripRef.current.querySelector('[data-active="true"]')
  activeEl?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })

  // 方案二：手动计算（iOS Safari 兜底）
  // const itemWidth = 76
  // const containerWidth = filmstripRef.current.offsetWidth
  // const targetScroll = currentIndex * itemWidth - containerWidth / 2 + itemWidth / 2
  // filmstripRef.current.scrollTo({ left: targetScroll, behavior: 'smooth' })
}, [currentIndex])
```

### 视觉层级动效参数

| 状态 | 样式 |
|------|------|
| 激活项 | `scale-[1.15] border-white brightness-100` |
| 相邻项（±1） | `scale-[1.05] border-white/50` |
| 其他项 | `opacity-50 grayscale-[30%]` |
| 过渡曲线 | `transition-transform duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]` |

### 键盘焦点管理（Focus Trap）

Viewer 打开时必须做 focus trap，关闭时焦点归还触发元素：

```tsx
const triggerRef = useRef<HTMLElement | null>(null)

const openViewer = (index: number, triggerEl: HTMLElement) => {
  triggerRef.current = triggerEl  // 记录触发元素
  setCurrentIndex(index)
}

const closeViewer = () => {
  setCurrentIndex(null)
  triggerRef.current?.focus()     // 归还焦点
  triggerRef.current = null
}
```

---

## 3. 图片缩放 & 平移手势

**参考日志**：`2025-05-25_13-37`、`2025-05-26_05-14`、`2025-05-26_06-27`、`2025-05-26_09-12`、`2025-05-26_09-19`、`2025-05-26_14-27`

### 双击缩放中心

双击应以**点击位置**为缩放中心，而非图片中心：

```tsx
const handleDoubleClick = (e: React.MouseEvent) => {
  const rect = containerRef.current!.getBoundingClientRect()
  const originX = e.clientX - rect.left  // 相对于容器的点击位置
  const originY = e.clientY - rect.top

  if (scale > 1) {
    // 已放大 → 复位
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  } else {
    // 复位 → 放大到点击位置
    setScale(2.5)
    setTranslate({
      x: -(originX - rect.width / 2),
      y: -(originY - rect.height / 2),
    })
  }
}
```

### 缩小后自动归位

缩放比例降到 `<= 1` 时，自动 reset 到 fit 状态（避免留在画面外）：

```tsx
useEffect(() => {
  if (scale <= 1) {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }
}, [scale])
```

### Swiper 与 Pinch-Zoom 冲突

Afilmory 最终因此移除了 Swiper。你的项目如果用滑动切换图片，需要区分两种手势：

```css
/* 图片容器：禁用浏览器默认 touch 行为 */
.photo-viewer-container {
  touch-action: none; /* 完全接管 touch 事件 */
}
```

```tsx
// 判断 pinch 还是 swipe
const onTouchMove = (e: TouchEvent) => {
  if (e.touches.length >= 2) {
    // pinch 手势 → 处理缩放，阻止 swipe
    e.preventDefault()
    handlePinch(e)
  } else if (scale <= 1) {
    // 未缩放状态 → 允许 swipe 切换图片
    handleSwipe(e)
  }
  // 已缩放时单指 → 处理平移
}
```

---

## 4. ThumbHash 占位符过渡 & 加载降级

**参考日志**：`2025-05-26_16-09`、`2025-06-04_06-31`、`2025-07-07_08-26Z`

### 无缝淡出过渡

原图加载完成后，占位符需要有 opacity 淡出动画，避免硬切换闪烁：

```tsx
const [imageLoaded, setImageLoaded] = useState(false)

return (
  <div className="relative overflow-hidden">
    {/* ThumbHash 占位符层 */}
    <canvas
      ref={thumbRef}
      className={cn(
        'absolute inset-0 w-full h-full transition-opacity duration-300',
        imageLoaded ? 'opacity-0' : 'opacity-100'
      )}
    />
    {/* 实际图片层 */}
    <img
      src={src}
      onLoad={() => setImageLoaded(true)}
      onError={() => setImageLoaded(false)} // 加载失败继续显示占位符
      className={cn(
        'w-full h-full object-contain transition-opacity duration-300',
        imageLoaded ? 'opacity-100' : 'opacity-0'
      )}
    />
  </div>
)
```

### 批量解码性能

ThumbHash 解码是同步计算，批量解码时会阻塞主线程：

```tsx
// ❌ 不要在渲染时同步批量解码
const decoded = photos.map(p => thumbHashToRGBA(p.thumbHash))

//  用 requestIdleCallback 分批解码
useEffect(() => {
  const queue = [...photos]
  const processNext = (deadline: IdleDeadline) => {
    while (deadline.timeRemaining() > 0 && queue.length > 0) {
      const photo = queue.shift()!
      decodeAndCache(photo.thumbHash)
    }
    if (queue.length > 0) requestIdleCallback(processNext)
  }
  requestIdleCallback(processNext)
}, [photos])
```

### 原图加载失败降级

```tsx
const [src, setSrc] = useState(photo.url)  // 原图 URL

<img
  src={src}
  onError={() => setSrc(photo.thumbnail)}  // 失败时回退到缩略图
  alt={photo.key}
/>
```

---

## 5. 事件监听器清理规范

**参考日志**：`2025-05-26_13-54`（事件监听器清理问题导致内存泄漏）

Afilmory 踩过的最典型坑：组件卸载后事件监听器未清理，导致内存泄漏和重复触发。

```tsx
//  所有 addEventListener 必须在 cleanup 中移除
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeViewer()
    if (e.key === 'ArrowLeft') navigatePrev()
    if (e.key === 'ArrowRight') navigateNext()
  }

  const handlePopState = () => { /* ... */ }

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('popstate', handlePopState)

  // ⚠️ 必须返回 cleanup 函数
  return () => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('popstate', handlePopState)
  }
}, [/* 依赖项 */])
```

**原则**：每个 `addEventListener` 都要有对应的 `removeEventListener`，且引用必须是**同一个函数对象**（不能用匿名函数）。

---

## 6. EXIF 数据处理细节

**参考日志**：`2025-05-25_15-20`、`2025-05-28_14-24`、`2025-05-26_05-06`

### DateTimeOriginal 时区处理

EXIF 的 `DateTimeOriginal` 格式为 `YYYY:MM:DD HH:mm:ss`，**不含时区信息**。

```ts
//  正确：配合 OffsetTimeOriginal 处理
function parseExifDate(dateTimeOriginal: string, offsetTimeOriginal?: string) {
  // 格式：'2024:03:15 14:30:00'
  const normalized = dateTimeOriginal.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')

  if (offsetTimeOriginal) {
    // 有时区偏移：'2024-03-15T14:30:00+08:00'
    return new Date(`${normalized}${offsetTimeOriginal}`)
  }

  // ❌ 不要用 new Date(normalized)，会被解析为 UTC 导致时间偏差
  //  按相机本地时间展示，不强制换算 UTC
  return new Date(normalized.replace(' ', 'T'))
}
```

### 竖拍宽高互换

EXIF Orientation 为 90°/270° 时，`photos.json` 输出的宽高值必须**提前互换**（sharp.rotate() 旋转后实际显示宽高已变换）：

```ts
async function getDisplayDimensions(imagePath: string) {
  const metadata = await sharp(imagePath).metadata()
  const { width, height, orientation } = metadata

  // Orientation 5-8 表示旋转 90° 或 270°
  const isRotated = orientation !== undefined && orientation >= 5

  return {
    width: isRotated ? height : width,
    height: isRotated ? width : height,
  }
}
```

**注意**：`sharp.rotate()` 会自动处理旋转，但如果在 `rotate()` **之前**调用 `metadata()`，读到的宽高仍是原始值。应在 `rotate()` 后读取，或手动根据 orientation 值互换。

### 富士 Film Recipe（可选）

如果使用富士相机，EXIF MakerNote 中包含胶片模拟信息，可通过更换 EXIF 解析库（如 `exiftool-vendored`）读取：

```ts
// 富士专属字段（需支持 MakerNote 解析的库）
const fujiRecipe = {
  filmMode: exif.FilmMode,           // 胶片模拟（如 'CLASSIC CHROME'）
  dynamicRange: exif.DynamicRange,
  colorChrome: exif.ColorChrome,
  grainEffect: exif.GrainEffect,
}
```

---

## 7. iOS Safari 兼容性

**参考日志**：`2025-05-27_05-30`（黑屏）、`2025-05-27_05-41`（模糊锯齿）、`2025-05-27_05-50`（双击缩放）、`2025-05-27_05-53`（HEIC 转换）

### Touch 事件处理

iOS Safari 对 `passive` 事件监听的处理与 Chrome 不同：

```tsx
useEffect(() => {
  const el = containerRef.current
  if (!el) return

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length >= 2 || scale > 1) {
      e.preventDefault() // ⚠️ 必须是 non-passive 才能 preventDefault
    }
  }

  // iOS Safari 要求显式声明 passive: false
  el.addEventListener('touchmove', handleTouchMove, { passive: false })
  return () => el.removeEventListener('touchmove', handleTouchMove)
}, [scale])
```

### 系统双击缩放冲突

iOS 上双击图片会触发系统级页面缩放，与 viewer 的双击放大冲突：

```html
<!-- 方案一：meta 标签禁用（影响整个页面可访问性，慎用） -->
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
```

```tsx
// 方案二（推荐）：在 viewer 组件内拦截，用 300ms 判断单击 vs 双击
const lastTapTime = useRef(0)
const handleTap = (e: React.TouchEvent) => {
  const now = Date.now()
  if (now - lastTapTime.current < 300) {
    e.preventDefault()     // 阻止系统双击缩放
    handleDoubleClick(e)   // 触发自定义双击缩放
  }
  lastTapTime.current = now
}
```

### Canvas 图像清晰度（若使用 Canvas 渲染）

如果后续使用 Canvas 渲染图片，必须处理 devicePixelRatio：

```tsx
const canvas = canvasRef.current
const dpr = window.devicePixelRatio || 1
canvas.width = containerWidth * dpr
canvas.height = containerHeight * dpr
const ctx = canvas.getContext('2d')!
ctx.scale(dpr, dpr) // 缩放绘制上下文以匹配物理像素
```

---

## 8. 标签系统 & 照片分组

**参考日志**：`2025-05-31_10-15`、`2025-05-31_13-06`、`2025-05-31_13-42`、`2025-06-05_11-33`、`2025-06-05_11-51`

### 未分类图片的默认 Tag

根目录下（不在任何子目录的）图片，赋予 `uncategorized` 作为默认 tag：

```ts
function extractTags(key: string): string[] {
  const parts = key.split('/').slice(0, -1) // 去掉文件名，只取目录部分
  return parts.length > 0 ? parts : ['uncategorized']
}
```

### 切换 Tag 时重新计算布局

masonic 是基于当前渲染项动态计算列布局的，切换 tag 过滤后需要强制重新布局：

```tsx
const [activeTag, setActiveTag] = useState<string | null>(null)
const filteredPhotos = useMemo(
  () => activeTag ? photos.filter(p => p.tags?.includes(activeTag)) : photos,
  [activeTag, photos]
)

// 传给 masonic 的 key 包含 activeTag，强制重新挂载并重算布局
<Masonry
  key={activeTag ?? 'all'}  // ⚠️ key 变化会触发完整重渲染
  items={filteredPhotos}
  render={PhotoCard}
/>
```

### 照片分组展示

按时间分组时，在分组 header 显示日期范围：

```tsx
function formatGroupHeader(photos: Photo[]) {
  const dates = photos.map(p => new Date(p.dateTaken)).sort((a, b) => +a - +b)
  const first = dates[0]
  const last = dates[dates.length - 1]

  if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
    return `${first.getFullYear()}年${first.getMonth() + 1}月 · ${photos.length}张`
  }
  return `${first.getFullYear()}年${first.getMonth()+1}月 — ${last.getFullYear()}年${last.getMonth()+1}月 · ${photos.length}张`
}
```

---

## 9. OG 图片 & RSS & Sitemap

**参考日志**：`2025-05-25_14-59`、`2025-05-25_15-15`、`2025-06-12_10-28`

### 动态 OG 图片生成

Astro 中为每张图片生成 OG meta（在 `[...slug].astro` 的 `<head>` 中）：

```astro
---
const { photo } = Astro.props
const origin = Astro.url.origin  // ⚠️ 必须用绝对 URL，否则 og:image 无效
---
<meta property="og:image" content={`${origin}${photo.thumbnail}`} />
<meta property="og:image:width" content={String(photo.width)} />
<meta property="og:image:height" content={String(photo.height)} />
```

**注意**：R2 CDN URL 已经是绝对路径（`https://cdn.xxx.com/...`），可直接作为 `og:image` 使用，不需要拼接 origin。

### RSS & Sitemap 建议

- Sitemap 的 `<lastmod>` 用照片 `DateTimeOriginal`（拍摄时间），而不是构建时间
- RSS item 的 `<pubDate>` 同上
- 可以通过 Astro Integration（`astro:build:done` 钩子）在构建完成后生成这两个文件

---

## 10. 构建脚本 & R2 优化

**参考日志**：`2025-05-26_06-21`、`2025-06-15_05-15`、`2025-06-17_06-17`

### 并行处理（图片量大时）

现有构建脚本是串行处理图片，当照片量超过 200 张时，可改为并行：

```ts
// 简单并行方案：Promise.all + 并发数控制
async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
) {
  const queue = [...items]
  const workers: Promise<void>[] = []

  for (let i = 0; i < concurrency; i++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const item = queue.shift()!
        await fn(item)
      }
    })())
  }

  await Promise.all(workers)
}

// 使用（并发数建议为 CPU 核心数）
await processWithConcurrency(newPhotos, 4, processOnePhoto)
```

**注意**：如果用 `worker_threads` 传递 `Map`/`Set`，需要先序列化为普通对象（`Map` 不能直接跨线程传递）。

### XHR 响应 Content-Type 验证

R2 存储的图片 Content-Type 有时为 `application/octet-stream`（非标准），前端加载时不能仅靠 MIME 类型判断是否为有效图片，应结合文件魔数（magic bytes）检测：

```ts
import { fileTypeFromBuffer } from 'file-type'

async function isValidImageBlob(blob: Blob): Promise<boolean> {
  const buffer = await blob.arrayBuffer()
  const type = await fileTypeFromBuffer(new Uint8Array(buffer))
  return type?.mime.startsWith('image/') ?? false
}
```

---

## 11. 移动端 UI 适配

**参考日志**：`2025-05-26_07-31`

### EXIF 面板在小屏的布局建议

| 屏幕尺寸 | EXIF 面板形式 |
|----------|---------------|
| `>= lg (1024px)` | 侧边 panel（右侧滑出） |
| `< lg` | 底部 drawer（从底部滑入） |

```tsx
const isMobile = useMediaQuery('(max-width: 1023px)')

return isMobile
  ? <BottomDrawer open={exifOpen} onClose={() => setExifOpen(false)}><ExifPanel /></BottomDrawer>
  : <SidePanel open={exifOpen}><ExifPanel /></SidePanel>
```

### 胶片条高度响应式

```css
.filmstrip {
  height: 60px; /* 移动端 */
}
@media (min-width: 768px) {
  .filmstrip {
    height: 80px; /* 桌面端 */
  }
}
```

---

## 12. 防坑清单（速查）

以下是 Afilmory 开发过程中踩过、且与 Lumen Gallery 高度相关的坑，开发时按此检查：

```
 基础
□ 所有 addEventListener 必须在 useEffect cleanup 中 removeEventListener
□ useEffect cleanup 中的函数引用要与添加时一致（不能用匿名函数）
□ history.pushState 在 setState 之后执行，不要颠倒顺序
□ GalleryWithViewer 添加 isMounted 防御，避免 SSR/CSR hydration 不一致

 图片处理
□ EXIF Orientation 5-8（竖拍）：photos.json 中 width/height 需要互换
□ sharp.rotate() 后再读 metadata，获取旋转后的实际尺寸
□ DateTimeOriginal 配合 OffsetTimeOriginal 处理时区；缺失时按本地时间展示，不换算 UTC
□ 原图加载失败时，onError 回退到缩略图展示

 性能
□ 胶片条超过 100 张必须用 @tanstack/virtual 虚拟化，不能全量渲染
□ ThumbHash 批量解码放入 requestIdleCallback，避免阻塞主线程
□ masonic 切换 tag 时给组件加 key={activeTag}，强制重新计算布局

 手势交互
□ Pinch-zoom 与 Swipe 手势互斥处理（scale > 1 时禁用 swipe）
□ touch 事件需要 passive: false 才能在 iOS Safari 中 preventDefault
□ 双击缩放中心为点击位置，不是图片中心
□ 缩放比例 <= 1 时自动 reset translate 到 (0, 0)

 iOS Safari 专项
□ touchmove 阻止需显式声明 { passive: false }
□ 双击事件用 300ms 时间差判断，不要依赖 dblclick 事件（iOS 不可靠）
□ 如果用 Canvas 渲染：宽高乘以 devicePixelRatio，绘制上下文 scale(dpr, dpr)

 URL & 导航
□ OG 图片 URL 必须是绝对路径（含 https://）
□ Sitemap lastmod 用照片拍摄时间，不用构建时间
□ popstate 监听处理浏览器前进（不只是后退）
□ Viewer 关闭时焦点归还触发元素（记录 triggerRef）
```

---

> 本文档基于 Afilmory 开发日志整理，Afilmory 使用纯 React SPA（Vite + react-router）+ WebGL 渲染器，
> 与 Lumen Gallery 的 Astro + React island 架构不同，请根据实际场景取舍。
> 部分高级特性（WebGL LOD 渲染、HEIC/HEIF 转换、Live Photo）暂不适用，已略去。
