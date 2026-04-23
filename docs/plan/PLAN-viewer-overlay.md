# 图片查看器 Overlay 改造方案

> 创建时间：2026-04-23  
> 状态：待实施  
> 参考目标：[Afilmory/afilmory](https://github.com/Afilmory/afilmory/tree/main/apps/web)

---

## 一、问题诊断

| 问题 | 根因 |
|------|------|
| 点击图片刷新列表 | `PhotoCard` 用 `<a href="/Gallery/photo.key">` 做整页导航，返回时浏览器重新渲染列表 |
| 胶片条切换体验差 | `[...slug].astro` 里的 filmstrip 切换依赖整页跳转，且没有 `scrollIntoView` 自动滚动到激活项 |
| `PhotoViewer.tsx` 被闲置 | 已写好的 modal overlay 组件从未被挂载，`MasonicGallery` 直接用 `<a>` 跳转 |

---

## 二、框架可行性评估

**结论：Astro 完全可以实现目标效果，不需要换框架。**

Afilmory 用的是纯 React SPA（Vite + react-router），其 viewer 是 URL 同步的 modal overlay。  
Lumen Gallery 用的是 Astro SSG + React island（`client:only="react"`），这个模式同样能实现：

- `MasonicGallery` 已是 `client:only="react"` island，gallery + viewer 都在同一个 React 树内
- URL 同步用 `history.pushState` + `popstate` 事件，无需路由库
- 直接访问 `/Gallery/[slug]` 的场景由现有 SSG 页面兜底（SEO、分享链接）

---

## 三、目标效果对标

参考 Afilmory 核心模式：

- 列表页常驻，viewer 以 **overlay** 覆盖展示（不跳页）
- 打开 viewer 时 `history.pushState` 写入 `/Gallery/photo-key`（URL 可分享）
- 关闭 viewer 时 `history.back()` 或 `history.pushState` 回到列表
- 浏览器后退键正确触发关闭（监听 `popstate`）
- 胶片条激活项自动居中滚动 + 视觉缩放过渡

---

## 四、具体改造步骤

### Step 1：修复 `MasonicGallery.tsx` — PhotoCard 改用 onClick

```
PhotoCard: <a href="/Gallery/..."> 
    ↓ 改为
PhotoCard: <div onClick={() => onPhotoClick(photo)}>
           + <a href="/Gallery/...">(保留 right-click / 中键在新标签打开)
```

- `MasonicGalleryProps.onPhotoClick` 已声明但未接入，补全即可
- `PhotoCard` 改为接受 `onClick` 回调（通过 masonic `render` 的 data + 外部注入）

### Step 2：新建 `GalleryWithViewer.tsx` — 状态管理 + URL 同步

新组件负责：

```
state: { currentIndex: number | null }   // null = viewer 关闭

onPhotoClick(photo) →
  1. setCurrentIndex(index)
  2. history.pushState({}, '', '/Gallery/' + photo.key)

onClose() →
  1. setCurrentIndex(null)
  2. history.back()   // 触发 popstate

popstate listener →
  若 URL = '/' 则关闭 viewer
  若 URL = '/Gallery/xxx' 则打开对应 photo（处理浏览器前进）

onNavigate(index) →
  1. setCurrentIndex(index)
  2. history.replaceState({}, '', '/Gallery/' + photos[index].key)
```

### Step 3：改进 `PhotoViewer.tsx` 胶片条

当前 `PhotoViewer.tsx` 没有胶片条（只有上下张按钮）。需新增并优化：

**激活项自动居中滚动：**

```tsx
useEffect(() => {
  const active = filmstripRef.current?.querySelector('[data-active="true"]')
  active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
}, [currentIndex])
```

**视觉层级效果：**

| 状态 | 样式 |
|------|------|
| 激活项 | `scale(1.15)` + `border-white` + `brightness(100%)` |
| 相邻项（±1） | `scale(1.05)` + 半透明 border |
| 其他项 | `opacity-50` + `grayscale(30%)` |
| 过渡 | `transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1)` |

**性能方案：**  
胶片条直接使用 `@tanstack/virtual` 虚拟化渲染（参考 Afilmory `GalleryThumbnail.tsx`），不使用原生滚动方案。实际照片数量必然超过 100 张，虚拟化是必要项而非优化项。

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

const rowVirtualizer = useVirtualizer({
  count: photos.length,
  getScrollElement: () => filmstripRef.current,
  estimateSize: () => 76,   // item width + gap
  horizontal: true,
  overscan: 5,
})
```

### Step 4：统一数据类型

当前 `PhotoViewer.tsx` 的 `Photo` 类型引用了 `thumbnails.medium`（plural），但 `photos.json` 实际字段是 `thumbnail`（singular，参见 `MasonicGallery.tsx` 的类型定义）。  
需统一类型定义，以实际 `photos.json` 为准。

### Step 5：`index.astro` — 替换组件

```astro
// 改前
<MasonicGallery client:only="react" photos={photos} columnWidth={240} />

// 改后
<GalleryWithViewer client:only="react" photos={photos} columnWidth={240} />
```

### Step 6：保留 `Gallery/[...slug].astro` 作为 fallback

| 场景 | 处理 |
|------|------|
| 直接访问 `/Gallery/xxx`（分享链接、SEO） | 现有 `[...slug].astro` 页面正常展示 |
| 从列表点击 | overlay 模式，不跳页 |
| 刷新 `/Gallery/xxx` | `[...slug].astro` 渲染，可选：加载后重定向到 `/?open=xxx` 再打开 overlay |

---

## 五、文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/GalleryWithViewer.tsx` | **新建** | 状态容器 + URL 同步逻辑 |
| `src/components/MasonicGallery.tsx` | **修改** | `PhotoCard` 改用 `onClick`，接入 `onPhotoClick` prop |
| `src/components/PhotoViewer.tsx` | **修改** | 新增胶片条，修复类型，优化滚动动效 |
| `src/pages/index.astro` | **修改** | 替换为 `GalleryWithViewer` |
| `src/pages/Gallery/[...slug].astro` | **保留不变** | fallback 直链页面 |

---

## 六、风险与注意事项

1. **SSR hydration**：`GalleryWithViewer` 需 `client:only="react"` + 初始 `isMounted` 检测，防止 SSR/CSR 不一致
2. **URL 同步时序**：`history.pushState` 发生在 `setCurrentIndex` 之后，避免 `popstate` 重复触发
3. **键盘焦点管理**：viewer 打开时做 focus trap；关闭时焦点归还触发元素（参考 Afilmory 的 `triggerElement` 设计）
4. **胶片条 ThumbHash**：React 版胶片条可复用 `ThumbHashImage` 做更好的占位符，替代裸 `<img>`
