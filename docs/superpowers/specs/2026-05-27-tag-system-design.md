# 标签系统设计

> 日期：2026-05-27
> 状态：待实现

## 概述

在 Lumen Gallery 中新增标签浏览页面，支持按标签筛选和关键词搜索照片。标签数据已由构建脚本从目录结构自动生成，本次工作聚焦于前端浏览和筛选体验。

## 需求

- 独立标签页面 `/tags/`
- 页面顶部显示所有标签按钮（pill 样式），支持多选（OR 逻辑）
- 搜索栏：匹配标签名、文件名、相机型号、镜头等 EXIF 元数据
- 搜索与标签取交集（AND），标签之间取并集（OR）
- 侧边栏添加标签页入口链接
- 无 URL 同步（纯前端状态）

## 现有数据基础

标签已在构建时由 `extractTagsFromPath()` 从 R2 目录结构提取，存入 `photos.json` 的 `tags: string[]` 字段。

```
R2 Bucket/photos/cat/kitten/photo.jpg → tags: ["cat", "kitten"]
```

`Photo` 类型已包含 `tags?: string[]`，`MasonicGallery` 卡片悬浮层已显示标签。

## 架构设计

### 页面

新建 `src/pages/tags/index.astro`：
- 复用 `GalleryPost.astro` 布局（左侧 Author 侧边栏 + 右侧内容区）
- 构建时读取 `public/photos.json`，提取所有唯一标签
- 将 `tags` 和 `photos` 作为 props 传给 `TagBrowser` React 组件

### 组件

新建 `src/components/TagBrowser.tsx`（React Island，`client:only="react"`）：

```
TagBrowser
├── 搜索栏（<input>，实时筛选）
├── 标签按钮区（pill 样式，多选 toggle）
└── MasonicGallery（复用，显示筛选后照片）
    └── PhotoViewer（复用，点击照片打开查看器）
```

Props：
```ts
interface TagBrowserProps {
  tags: string[]       // 所有唯一标签
  photos: Photo[]      // 全部照片数据
  columnWidth?: number // 瀑布流列宽，默认 240
}
```

### 筛选逻辑

```ts
function filterPhotos(photos: Photo[], selectedTags: string[], searchQuery: string): Photo[] {
  return photos.filter(photo => {
    // 标签筛选：无选中 → 全部通过；有选中 → 照片标签与选中标签有交集
    const tagMatch = selectedTags.length === 0 ||
      selectedTags.some(tag => photo.tags?.includes(tag))

    // 搜索筛选：无输入 → 全部通过；有输入 → 匹配标签名/文件名/EXIF
    const searchMatch = !searchQuery ||
      matchSearch(photo, searchQuery.toLowerCase())

    // 两个条件取交集（AND）
    return tagMatch && searchMatch
  })
}
```

搜索匹配范围：
- 标签名（`photo.tags`）
- 文件名（`photo.filename`）
- 相机制造商（`photo.exif.make`）
- 相机型号（`photo.exif.model`）
- 镜头型号（`photo.exif.lensModel`）

### 侧边栏入口

在 `Author.astro` 的 `.meta-group` 区域底部添加"标签"链接：

```html
<div class="meta-item">
  <span class="meta-label">标签</span>
  <a href="/tags/" class="value link">浏览标签</a>
</div>
```

### 数据流

```
构建时:
  photos.json → Astro 读取 → 提取唯一标签 → props 传入 TagBrowser

运行时:
  用户输入搜索 → 前端文本匹配 → 更新 filteredPhotos
  用户点击标签 → toggle selectedTags → 更新 filteredPhotos
  两个条件 AND → MasonicGallery 渲染筛选结果
```

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/pages/tags/index.astro` | 新建 | 标签页面 |
| `src/components/TagBrowser.tsx` | 新建 | 标签筛选组件 |
| `src/components/Author.astro` | 修改 | 添加标签页入口链接 |

## 不做的事

- 不做 URL 同步（纯前端状态）
- 不做标签计数显示
- 不做独立的 `/tags/[tag]` 页面
- 不修改构建脚本（标签提取逻辑已满足需求）
