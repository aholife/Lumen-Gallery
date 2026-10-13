# AI 协作会话日志

> 记录每次与 AI 协作开发的摘要，便于复盘和追溯。
> 新的记录追加到最上方。

---

## 2026-09-08 — photos.json 按拍摄时间降序排序

**目标**：查明 `photos.json` 与页面展示顺序的来源，并改为按 EXIF 拍摄时间降序排列（最新在前）。

**排查结论**：
- 此前整条链路**没有任何显式排序**，数组顺序等于 `storage.listFiles()` 的返回顺序：
  - Local：`readdir()` 文件系统顺序（平台相关，近似任意）
  - R2：`ListObjectsV2` 按 key 字典序
  - GitHub：Contents API 按目录内字母序、深度优先
- 前端（`GalleryWithViewer` / `MasonicGallery` / `PhotoViewer` 胶片条 / `[...slug].astro` 上下张）完全按 `photos.json` 数组顺序渲染，无 `sort`/`reverse`。

**主要变更**：
1. `scripts/build-images.ts`、`scripts/build-images-r2.ts` — 在 `saveMetadata*()` 之前对 `metadata` 按 `exif.dateTime` 降序排序
   ```ts
   metadata.sort((a, b) => {
     const dateA = a.exif?.dateTime ? new Date(a.exif.dateTime).getTime() : 0;
     const dateB = b.exif?.dateTime ? new Date(b.exif.dateTime).getTime() : 0;
     return dateB - dateA;
   });
   ```
2. 无 EXIF 日期的照片（`getTime()` 为 0）排到列表末尾
3. 排序放在构建时而非前端，保证 `photos.json` 即真相源；画廊、查看器导航、胶片条顺序自动一致
4. R2 增量构建跳过的条目原本会停留在旧位置，统一末尾排序后增量/全量构建输出顺序一致

**遗留**：
- `public/photos.json` **未重新生成**（会话结束时仍是 key 序），需重跑构建脚本才会生效
- `src/lib/image/exif.ts` **未读取 `OffsetTimeOriginal`**，与 `AFILMORY_LEARNINGS.md` §6 / CONTEXT.md 的要求不符 —— 排序不受影响（偏移一致），但展示时间可能有系统性时区偏移

---

## 2026-09-08 — Netlify 部署配置与上线

**目标**：先 `/init` 生成 CLAUDE.md，再把站点部署到 Netlify 并排查代码问题。

**主要变更**：

1. **新建 `netlify.toml`（仅 `netlify` 分支）**
   - `command = "pnpm install && pnpm build:r2"`，`publish = "dist"`，`NODE_VERSION = 20`
   - `STORAGE_MODE = "r2"`，`R2_PUBLIC_URL = "https://photos.echorains.top"`
   - 无 redirects（见下方踩坑）

2. **分支拆分约定**：部署配置只进 `netlify` 分支（用户明确「dev分支不保留」）；`dev` 只留代码/内容改动。耦合文件（`consts.ts` + `index.astro`）需双分支落地，用 `git checkout <branch> -- <path>` 同步。

3. **双域名**
   - 站点：`https://gallery.echorains.top` → `astro.config.mjs` 的 `site`（影响 SEO/OG 绝对 URL）
   - 图片 CDN：`https://photos.echorains.top` → `R2_PUBLIC_URL`
   - 初版把两者配成同一个域名，用户指出后修正

4. **站点标识**：`src/consts.ts` 更新为「落花流水集·影 / 偶尔拍拍 / Aholife」；`src/pages/index.astro` 改用 `SITE_TITLE`/`SITE_DESCRIPTION` 常量（双分支同步）

5. **Netlify 控制台**：Base/Functions 目录留空；密钥（`R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET_NAME`）在 UI 里用 "Add key/value pairs" 添加，不要 import `.env`

**部署踩坑**：
- 构建报 `tsx: not found` —— `tsx` 是 devDependency，必须先 `pnpm install` 再跑 `build:r2`
- 站点全站 404 —— 初版 `[[redirects]]` 带 `conditions = { Role = ["admin"] }`，普通访客全部匹配失败；静态 Astro 站点不需要 SPA redirect，整块删除后恢复
- `pnpm-lock.yaml` 在 `.gitignore` 中 —— Netlify 安装不可复现的风险，用户中断了修复，**待决**
- `netlify.toml` 中 `NPM_FLAGS = "--version"` 意图不明，未清理

---

## 2026-05-27 — 标签系统实现

**目标**：阅读 docs 决定下一步开发内容；用户选定标签系统，并明确「多尺寸缩略图这个功能不要了」。

**需求锁定**：独立 `/tags/` 页面（用户中途否掉「首页顶部标签栏」方案）；多选标签 OR；搜索与标签 AND；不做 URL 同步、不做标签计数；入口放侧边栏（站点无顶部导航，布局为 `GalleryPost.astro` 左 260px 信息栏 + 右瀑布流）。

**主要变更**：
1. **新建 `src/components/TagBrowser.tsx`** — 搜索（标签/文件名/相机 make/model/镜头 lensModel，`includes` 不区分大小写）+ 多选标签 + 复用 `MasonicGallery`/`PhotoViewer`；`useDeferredValue` 保持输入流畅；「清除筛选」+ 结果计数
2. **新建 `src/pages/tags/index.astro`** — 读 `photos.json`，`Set` 去重 + 排序提取标签，`client:only="react"` 挂载
3. **修改 `src/components/Author.astro`** — 侧边栏「标签 / 浏览标签」入口；链接类名修正为 `meta-value link`（`value link` 与兄弟节点字重字号不一致）
4. **`TagBrowser.tsx`** — 筛选变化时 clamp/重置 viewer 索引（终审发现：`currentIndex` 会越界或指向错误照片）

**验证**：无测试脚本，以 `pnpm build` 为验收门槛（128 pages, 119 photos, 9 tags）。用户选择「保持现状」—— 工作留在 `dev`，未合入 `master`、未推送。

**防坑（本次踩到）**：
- **`tsc`/`astro check` 在本仓库不可用** —— TypeScript 非直接依赖，`npx tsc` / `pnpm exec tsc` 均失败；`astro check` 要求安装 `@astrojs/check typescript` 且在非交互 shell 卡在 Y/n 确认。**验证一律用 `pnpm build`**
- Windows Git Bash：`2>$null` 会报 ambiguous redirect，用 `2>/dev/null`
- `Author.astro` 中 `.value` 与 `.meta-value` 是两套样式，侧边栏 meta-group 必须用 `meta-value`
- 一次误操作重复粘贴了 `.meta-label`/`.meta-value` CSS 块，靠重读文件发现并清理

**评审遗留（技术债，未修）**：
- `index.astro` 与 `tags/index.astro` 重复实现 photos.json 读取/解析，应抽公共工具
- `JSON.parse` 失败会走「Photos not processed yet」误导性提示
- `.astro` 页面中 `export const title/description/pubDate` 是死代码
- 骨架屏是 CSS grid、真画廊是 masonry，hydrate 时有 CLS
- `closeViewer` 的 `setTimeout(100)` 可能在卸载后触发
- 搜索框缺 `aria-label` / `type="search"` / 清除按钮

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
