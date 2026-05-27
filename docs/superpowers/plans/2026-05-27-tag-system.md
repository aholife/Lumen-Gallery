# 标签系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增标签浏览页面，支持按标签多选筛选和关键词搜索照片。

**Architecture:** Astro SSG 页面读取 `photos.json` 提取标签，传给 React Island 组件 `TagBrowser`。组件内部管理搜索/选中状态，复用 `MasonicGallery` 和 `PhotoViewer` 渲染筛选结果。

**Tech Stack:** Astro, React, TypeScript, Tailwind CSS, Masonic, @tanstack/react-virtual

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/components/TagBrowser.tsx` | 新建 | 标签筛选 + 搜索 + 画廊 + 查看器 |
| `src/pages/tags/index.astro` | 新建 | 标签页面，读取数据传给组件 |
| `src/components/Author.astro` | 修改 | 添加标签页入口链接 |

---

### Task 1: 创建 TagBrowser 组件

**Files:**
- Create: `src/components/TagBrowser.tsx`

- [ ] **Step 1: 创建 TagBrowser.tsx 骨架**

```tsx
// src/components/TagBrowser.tsx
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import MasonicGallery from './MasonicGallery';
import PhotoViewer from './PhotoViewer';
import type { Photo } from '../types/photo';

interface TagBrowserProps {
  tags: string[];
  photos: Photo[];
  columnWidth?: number;
}

const TagBrowser: React.FC<TagBrowserProps> = ({
  tags,
  photos,
  columnWidth = 240,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ========== 搜索匹配逻辑 ==========
  const matchSearch = useCallback((photo: Photo, query: string): boolean => {
    const q = query.toLowerCase();
    // 标签名
    if (photo.tags?.some(tag => tag.toLowerCase().includes(q))) return true;
    // 文件名
    if (photo.filename.toLowerCase().includes(q)) return true;
    // EXIF: 相机制造商
    if (photo.exif?.make?.toLowerCase().includes(q)) return true;
    // EXIF: 相机型号
    if (photo.exif?.model?.toLowerCase().includes(q)) return true;
    // EXIF: 镜头型号
    if (photo.exif?.lensModel?.toLowerCase().includes(q)) return true;
    return false;
  }, []);

  // ========== 筛选逻辑 ==========
  const filteredPhotos = useMemo(() => {
    return photos.filter(photo => {
      // 标签筛选：无选中 → 全部通过；有选中 → 照片标签与选中标签有交集
      const tagMatch = selectedTags.length === 0 ||
        selectedTags.some(tag => photo.tags?.includes(tag));

      // 搜索筛选：无输入 → 全部通过；有输入 → 匹配
      const searchMatch = !searchQuery ||
        matchSearch(photo, searchQuery);

      // 两个条件取交集（AND）
      return tagMatch && searchMatch;
    });
  }, [photos, selectedTags, searchQuery, matchSearch]);

  // ========== 标签切换 ==========
  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  }, []);

  // ========== 清除所有选中 ==========
  const clearTags = useCallback(() => {
    setSelectedTags([]);
    setSearchQuery('');
  }, []);

  // ========== Viewer 操作 ==========
  const openViewer = useCallback((photo: Photo, index: number) => {
    triggerRef.current = document.activeElement as HTMLElement;
    setCurrentIndex(index);
  }, []);

  const closeViewer = useCallback(() => {
    setCurrentIndex(null);
    setTimeout(() => {
      triggerRef.current?.focus();
      triggerRef.current = null;
    }, 100);
  }, []);

  const navigateTo = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  // ========== SSR 骨架屏 ==========
  if (!isMounted) {
    return (
      <div className="w-full">
        <div className="h-10 bg-gray-200 rounded-lg animate-pulse mb-4" />
        <div className="flex flex-wrap gap-2 mb-6">
          {tags.slice(0, 8).map(tag => (
            <div key={tag} className="h-8 w-16 bg-gray-200 rounded-full animate-pulse" />
          ))}
        </div>
        <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.slice(0, 8).map(photo => (
            <div
              key={photo.id}
              className="bg-gray-200 rounded-lg animate-pulse"
              style={{ aspectRatio: `${photo.width}/${photo.height}` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* 搜索栏 */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索标签、文件名、相机、镜头..."
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            placeholder-gray-400"
        />
      </div>

      {/* 标签按钮区 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tags.map(tag => {
          const isSelected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200
                ${isSelected
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              #{tag}
            </button>
          );
        })}
        {(selectedTags.length > 0 || searchQuery) && (
          <button
            onClick={clearTags}
            className="px-3 py-1.5 rounded-full text-sm font-medium
              bg-red-50 text-red-600 hover:bg-red-100 transition-all duration-200"
          >
            清除筛选
          </button>
        )}
      </div>

      {/* 结果计数 */}
      {(selectedTags.length > 0 || searchQuery) && (
        <div className="text-sm text-gray-500 mb-4">
          找到 {filteredPhotos.length} 张照片
        </div>
      )}

      {/* 瀑布流画廊 */}
      <MasonicGallery
        photos={filteredPhotos}
        columnWidth={columnWidth}
        onPhotoClick={openViewer}
      />

      {/* 图片查看器 */}
      <PhotoViewer
        photos={filteredPhotos}
        currentIndex={currentIndex ?? 0}
        isOpen={currentIndex !== null}
        onClose={closeViewer}
        onNavigate={navigateTo}
      />
    </div>
  );
};

export default TagBrowser;
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd "D:\Work\参考-临时\Lumen-Gallery" && npx tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 3: 提交**

```bash
git add src/components/TagBrowser.tsx
git commit -m "feat(tags): add TagBrowser component with search and multi-select filtering"
```

---

### Task 2: 创建标签页面

**Files:**
- Create: `src/pages/tags/index.astro`

- [ ] **Step 1: 创建 tags/index.astro**

```astro
---
// src/pages/tags/index.astro
import Layout from "../../layouts/GalleryPost.astro"
import TagBrowser from "../../components/TagBrowser"
import "../../styles/global.css"
import { readFile } from "fs/promises"
import { join } from "path"
import type { Photo } from "../../types/photo"

export const title = "标签浏览"
export const description = "按标签浏览照片"
export const pubDate = new Date()

// 读取照片元数据
let photos: Photo[] = []
let tags: string[] = []
let hasPhotos = false

try {
  const photosPath = join(process.cwd(), "public", "photos.json")
  const data = await readFile(photosPath, "utf-8")
  photos = JSON.parse(data)
  hasPhotos = photos.length > 0

  // 提取所有唯一标签并排序
  const tagSet = new Set<string>()
  for (const photo of photos) {
    if (photo.tags) {
      for (const tag of photo.tags) {
        tagSet.add(tag)
      }
    }
  }
  tags = Array.from(tagSet).sort()
  console.log(`✅ Loaded ${photos.length} photos, ${tags.length} tags`)
} catch (error) {
  console.log("⚠️  Photos not processed yet. Run: pnpm process-images")
}
---

<Layout title={title} description={description} pubDate={pubDate}>
  <article class="tags-page">
    {
      !hasPhotos ? (
        <div class="empty-state">
          <h2>暂无照片</h2>
          <p>请先处理照片：pnpm process-images</p>
        </div>
      ) : (
        <div class="tags-container">
          <TagBrowser client:only="react" tags={tags} photos={photos} columnWidth={240} />
        </div>
      )
    }
  </article>
</Layout>

<style>
  .tags-page {
    width: 100%;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: #64748b;
  }

  .empty-state h2 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: #1e293b;
  }

  .tags-container {
    width: 100%;
  }
</style>
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd "D:\Work\参考-临时\Lumen-Gallery" && npx tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 3: 提交**

```bash
git add src/pages/tags/index.astro
git commit -m "feat(tags): add /tags/ page"
```

---

### Task 3: 添加侧边栏入口链接

**Files:**
- Modify: `src/components/Author.astro:119-128`

- [ ] **Step 1: 在 meta-group 中添加标签链接**

在 `Author.astro` 的 `.meta-group` 区域（`照片总数` 之后）添加标签入口：

```astro
    <div class="info-group meta-group">
        <div class="meta-item">
            <span class="meta-label">最后更新</span>
            <span class="meta-value">{lastUpdate}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">照片总数</span>
            <span class="meta-value">{totalPhotos}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">标签</span>
            <a href="/tags/" class="value link">浏览标签</a>
        </div>
    </div>
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd "D:\Work\参考-临时\Lumen-Gallery" && npx tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 3: 提交**

```bash
git add src/components/Author.astro
git commit -m "feat(tags): add tags page entry link to sidebar"
```

---

### Task 4: 端到端验证

- [ ] **Step 1: 启动开发服务器**

Run: `cd "D:\Work\参考-临时\Lumen-Gallery" && pnpm dev`
Expected: 服务器启动成功

- [ ] **Step 2: 验证标签页面**

在浏览器中访问 `http://localhost:4321/tags/`，确认：
1. 页面正常加载，显示搜索栏和标签按钮
2. 点击标签按钮可筛选画廊内容
3. 多选标签时结果取并集（OR）
4. 搜索栏输入关键词可匹配文件名、相机、镜头
5. 搜索 + 标签取交集（AND）
6. 点击照片可打开 PhotoViewer
7. "清除筛选"按钮可重置状态

- [ ] **Step 3: 验证侧边栏入口**

访问首页 `http://localhost:4321/`，确认：
1. 左侧 Author 侧边栏显示"标签"链接
2. 点击后跳转到 `/tags/`

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat: complete tag system with search and filtering"
```
