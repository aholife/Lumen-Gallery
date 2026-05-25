# AI 协作会话日志

> 记录每次与 AI 协作开发的摘要，便于复盘和追溯。
> 新的记录追加到最上方。

---

## 2026-05-25 — Viewer Overlay 改造完成

**目标**：实现不刷新页面的图片查看体验，对标 Afilmory。

**主要变更**：

1. **新建 `src/types/photo.ts`** — 共享 Photo 类型，对齐 `photos.json` 实际字段（`thumbnail` 单数、`thumbHash` camelCase、`exif` 小写驼峰）。消除了 `PhotoViewer.tsx` 中旧的 `thumbnails`/`Original`/`blurhash` 不一致问题。

2. **新建 `src/components/GalleryWithViewer.tsx`** — 状态容器组件：
   - 管理 `currentIndex: number | null` 状态（null = viewer 关闭）
   - URL 同步：`history.pushState` 在 `setState` 之后执行（避免 popstate 竞争）
   - `popstate` 监听器在 `useEffect` cleanup 中移除
   - `isMounted` 防御 SSR/CSR hydration 不一致
   - `triggerRef` 记录触发元素，关闭时归还焦点

3. **重写 `src/components/MasonicGallery.tsx`**：
   - `PhotoCard` 改用 `onClick` 回调替代 `<a>` 整页跳转
   - 保留隐藏 `<a>` 标签用于右键/中键"在新标签中打开"
   - 使用共享 Photo 类型
   - 修复 hooks 调用顺序 bug（`useCallback` 必须在条件返回之前）

4. **重写 `src/components/PhotoViewer.tsx`**：
   - 胶片条使用 `@tanstack/react-virtual` 虚拟化渲染（100+ 张仍流畅）
   - 缩放：滚轮缩放（以鼠标位置为中心）、双击缩放（以点击位置为中心，300ms 判断）、双指捏合
   - 平移：放大后拖拽平移，缩放 <= 1 自动归位
   - 原图降级：`onError` 回退到缩略图
   - 键盘：←/→ 切换、Esc 关闭、i 切换侧边栏
   - 内联 CSS 样式，无外部依赖

5. **更新 `src/pages/index.astro`** — 替换为 `GalleryWithViewer`，清理 ~200 行未使用的旧 CSS

6. **删除 `src/components/BlurHashImage.astro`** — 未被任何文件引用

7. **新增依赖** `@tanstack/react-virtual`

**受影响文件**：
- `src/types/photo.ts`（新建）
- `src/components/GalleryWithViewer.tsx`（新建）
- `src/components/MasonicGallery.tsx`（重写）
- `src/components/PhotoViewer.tsx`（重写）
- `src/pages/index.astro`（修改）
- `src/components/BlurHashImage.astro`（删除）
- `package.json`（新增依赖）

---

## 2026-04-01 — R2 构建空目录报错修复 & 增量构建（跳过已处理图片）

**问题 1**: 运行 `process-images:r2` 时，R2 存储桶中的空目录标记（size=0）或非图片文件会被传入 Sharp，导致 `Input Buffer is empty` 错误。

**解决方案 1**:
- `processImagesR2()` 文件过滤阶段新增两项检查：跳过 `size === 0` 的条目（R2 目录标记）、跳过扩展名不在图片格式白名单中的文件
- 新增 `IMAGE_EXTENSIONS` 常量，涵盖常见图片格式

**问题 2**: 每次运行构建脚本都会重新处理所有图片并重新上传缩略图，耗时且产生重复操作。

**解决方案 2**:
- 构建前先列出 R2 `.thumbnails/` 下已有的缩略图 key
- 加载已有的 `public/photos.json` 作为 `existingMetadata`
- 通过 R2 ETag（内容哈希）检测原图是否变更：如果缩略图已存在 + 元数据已有 + etag 一致则跳过；若同名文件被替换（etag 不一致）则重新处理
- `ImageMetadata` 新增可选字段 `etag`，保存原图的 R2 ETag
- 提取 `getThumbnailR2Key()` 辅助函数统一缩略图路径计算

**受影响文件**:
- `src/lib/image/types.ts` — `ImageMetadata` 新增 `etag` 字段；`ProcessImageOptions` 新增 `existingMetadata` 字段
- `src/lib/image/index-r2.ts` — 新增图片格式白名单、空文件过滤、基于 etag 的缩略图存在性检查、`getThumbnailR2Key()` 函数
- `scripts/build-images-r2.ts` — 加载已有 `photos.json` 并传入 `existingMetadata`

---

## 2026-03-31 — R2 构建忽略目录功能 & .thumbnails 过滤修复

**问题**: R2 模式构建时 `storage.listFiles()` 会返回存储桶中所有对象，包括 `.thumbnails/` 下的缩略图，导致缩略图被当作原图再次处理并出现在 `photos.json` 中。

**解决方案**:
1. 新增 `R2_IGNORE_DIRS` 环境变量，支持逗号分隔的多个目录名
2. `.thumbnails` 作为硬编码默认忽略项，无论环境变量是否配置都生效
3. `processImagesR2()` 新增 `ignoreDirs` 参数，在文件列表阶段提前过滤

**受影响文件**:
- `.env.example` — 新增 `R2_IGNORE_DIRS` 配置项
- `src/lib/image/types.ts` — `ProcessImageOptions` 新增 `ignoreDirs` 字段
- `scripts/build-images-r2.ts` — 读取环境变量并合并默认忽略项
- `src/lib/image/index-r2.ts` — 文件列表过滤逻辑

---

## 2026-03-12 — 修复 Node 脚本环境变量问题

**问题**: tsx 直接执行脚本时 `import.meta.env` 为 `undefined`，`process.env` 也为空。

**根因**: 纯 Node.js 运行时下 Vite/Astro 不注入 `import.meta.env`，Node 默认不加载 `.env` 文件。

**解决方案**:
1. 安装 `dotenv`（devDependencies）
2. 脚本入口添加 `import 'dotenv/config'`
3. `getEnv()` 保持双重兜底逻辑

**受影响文件**:
- `scripts/build-images-r2.ts` — 添加 dotenv import
- `src/lib/storage/index.ts` — 移除调试日志
- `package.json` — 添加 dotenv devDependency

---

## 2026-02-11 — 参考 Afilmory 全面改进图片处理流水线

**主要变更**:
1. R2 S3 兼容配置 — `requestChecksumCalculation` + `responseChecksumValidation`
2. EXIF 自动旋转 — `sharp.rotate()` + 旋转后尺寸计算
3. BlurHash → ThumbHash — 体积更小、质量更高、支持透明度
4. JPEG → WebP 缩略图 — 更高效压缩

**受影响文件**:
- `src/lib/storage/r2.ts`
- `src/lib/image/processor.ts`（重写）
- `src/lib/image/types.ts`（`blurhash` → `thumbHash`）
- `src/lib/image/index.ts`, `index-r2.ts`
- `src/components/MasonicGallery.tsx`, `BlurHashImage.astro`
- `src/pages/Gallery/[...slug].astro`
- `scripts/build-images.ts`, `build-images-r2.ts`
- `package.json`（移除 blurhash，添加 thumbhash）

---

## 2026-02-10 — R2 全托管模式实现

**主要变更**:
- 创建 `src/lib/image/index-r2.ts` — R2 专用图片处理模块
- 创建 `scripts/build-images-r2.ts` — R2 专用构建脚本
- 添加 `pnpm run process-images:r2` 和 `pnpm run build:r2` 命令

**架构**:
```
R2 Bucket/
├── photos/         # 原图
└── .thumbnails/    # 缩略图（构建时生成上传）

本地/
└── public/photos.json  # 仅元数据
```

**优势**: 仓库轻量、R2 CDN 加速、图片与代码分离

---

## 2025-11-27 — 项目初始化与状态确认

- 创建开发日志
- 确认基础设施及图片处理脚本已就绪
- 发现 `MasonicGallery.tsx`，瀑布流功能开发中
