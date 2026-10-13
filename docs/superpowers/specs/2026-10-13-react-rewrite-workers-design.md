# Lumen Gallery v2 — React 重写 + Cloudflare Workers 部署设计

> 日期：2026-10-13
> 状态：已定稿，待实现
> 参考：[Afilmory/afilmory](https://github.com/Afilmory/afilmory) `apps/web`、`docs/AFILMORY_LEARNINGS.md`

---

## 1. 背景与动机

当前 Astro + React islands 架构功能完整（Viewer Overlay、标签系统均已上线 Netlify），但与参考项目 Afilmory 的体验差距明显。四个核心痛点：

| # | 痛点 | 现状 | 目标 |
|---|------|------|------|
| 1 | **详情页加载慢** | viewer 直接请求 16–23MB 原图，中间只有全屏 spinner | Thumbhash → 缩略图 → 原图 渐进加载，无黑屏 |
| 2 | **标签筛选无动画** | 过滤时整个 Masonry 被 `key={shrunk-Date.now()}` 硬重挂 | 瀑布流重组排列动画（GSAP Flip） |
| 3 | **手机端单列太大** | `columnWidth=240` 导致手机只能排 1 列 | 默认双列，可切换 单列/双列 |
| 4 | **EXIF 展示粗糙** | 手机/PC 布局都不对，两套重复 sidebar | PC 右侧默认展开；手机底部抽屉默认收起 |

同时，部署目标由 Netlify 改为 **Cloudflare Workers**（图片已在 R2，同生态、零出口流量费）。

### 为什么要完整重写而不是打补丁

- Astro islands 的 `client:only` + 手写 `history.pushState` 同步，在共享元素转场、渐进加载状态机、跨组件动画编排上处处受限
- Afilmory 的「感觉」来自一整套客户端状态机（ProgressiveImage / FLIP / LRU blob cache），在 Astro 里复刻的成本不低于重写
- 博客/关于/RSS 是 Astro 脚手架占位内容，无迁移价值

**结论：完整 React 重写。** 构建流水线 / 存储层 / `photos.json` 契约原样复用。

---

## 2. 关键发现（决定架构）

Afilmory 的渐进加载阶梯是：

```
Thumbhash (~25B)  →  600w JPEG 缩略图  →  原图 (XHR blob + 进度)
```

**没有 srcset、没有多尺寸缩略图、没有 blurDataURL。**

Lumen 已有 ThumbHash + 800w WebP + 原图，**阶梯齐备**。差距只在 viewer 没有走这条阶梯（直接请求原图 + spinner）。

> 因此 **不需要** 推翻 2026-05-27「取消多尺寸缩略图」的决定。单张 800w 策略继续有效。

---

## 3. 技术选型

| 项 | 选择 | 理由 |
|----|------|------|
| 框架 | **Vite + React 19 SPA** | 与 Afilmory 同构；交互全是客户端，不需要 RSC/SSR |
| 路由 | **react-router v7** (`createBrowserRouter`) | Afilmory 同款；支持 `/photos/:id` 深链 |
| 状态 | **Zustand** | viewer / gallery / URL 三态耦合；AFILMORY_LEARNINGS 明确后悔没一开始就用 |
| 动画 | **motion**（framer-motion 后继）+ **GSAP Flip** | motion 管 viewer 共享元素/淡入；GSAP Flip 专做标签筛选瀑布流重组 |
| **图片渲染** | **WebGPU 优先 + WebGL 降级**（`webgl-viewer`） | 放大仍锐利（LOD）、GPU 惯性平移、HDR Gain Map；推翻「暂不使用 WebGL」 |
| 布局 | **masonic**（已依赖） | 沿用；单元格按 `width/aspectRatio` 预定尺寸，零 CLS |
| 样式 | **Tailwind CSS v4** | 已配置；抛弃 PhotoViewer 内 320 行内联 CSS |
| 部署 | **Cloudflare Workers Static Assets** | SPA fallback + 自定义域名；与 R2 同生态 |
| 图片 CDN | **R2 `photos.echorains.top`** | 不变 |

**不引入：** Next.js、SSR、服务端预切片（LOD 瓦片客户端生成）。

---

## 4. 目标架构

```
storage (R2 / local / GitHub)
  → scripts/build-images*.ts          【复用】sharp + exifr + thumbhash
    → public/photos.json               【契约不变】
    → R2 .thumbnails/*_thumb.webp      【不变，800w WebP】

Vite SPA (React 19 + react-router)
  ├── /                     Gallery（masonry + 渐进缩略图 + 列数切换）
  ├── /tags                 TagBrowser（GSAP Flip 瀑布流重组）
  ├── /photos/:id           PhotoViewer
  │                           ├── ProgressiveImage（Thumbhash → 800w → blob）
  │                           ├── ImageViewer（WebGPU/WebGL + LOD，原图渲染面）
  │                           └── ExifPanel（PC 右侧 / 手机底部抽屉）
  └── /about                简单关于页

Cloudflare Workers Static Assets
  └── dist/  +  SPA fallback → index.html
```

### 项目结构（重写后）

```
/
├── scripts/                    # 【复用】build-images.ts / build-images-r2.ts
├── src/
│   ├── lib/                    # 【复用】storage/ + image/（Node 专用，不进前端 bundle）
│   ├── types/photo.ts          # 【复用】Photo 契约（补 aspectRatio）
│   ├── consts.ts               # 【复用】站点信息
│   └── web/                    # 【全新】React SPA
│       ├── main.tsx
│       ├── router.tsx
│       ├── lib/                # image-loader-manager, thumbhash decode, format helpers
│       ├── modules/
│       │   ├── gallery/        # MasonryView, MasonicPhotoItem, AnimatedMasonry, ColumnToggle
│       │   ├── viewer/         # PhotoViewer, ProgressiveImage, Filmstrip, hooks
│       │   │   └── webgl-viewer/  # 【移植】ImageViewer + WebGL/WebGPU 引擎 + LOD + gainmap
│       │   ├── metadata/       # ExifPanel, LoadingIndicator
│       │   └── tags/           # TagBrowser
│       ├── stores/             # zustand: galleryStore, viewerStore
│       └── components/         # Layout, 共享 UI
├── index.html                  # Vite 入口
├── vite.config.ts
├── wrangler.jsonc              # Workers Static Assets
├── public/photos.json          # 构建产物（构建期内联）
└── package.json
```

**删除/淘汰：** `src/pages/**`、`src/layouts/**`、`src/components/*.astro`、`src/content/**`、`astro.config.mjs`、blog/RSS 脚手架。`netlify` 分支部署配置作废。

---

## 5. 核心体验设计

### 5.1 渐进加载（痛点 1）— 最高优先级

照搬 Afilmory `ProgressiveImage` 状态机，三级阶梯：

| 阶段 | 内容 | 条件 |
|------|------|------|
| A. Thumbhash | 全屏模糊色块背景 + 网格单元格占位 | 立即 |
| B. 缩略图 | 800w WebP `<img>`，`opacity 0→1` 300ms 淡入 | `onLoad` |
| C. 原图 | XHR blob + 进度 → **交给 WebGL/Canvas 渲染面** | **仅当前激活张**下载 |

**不能省的细节**（这些是「有 Afilmory 感觉」的原因）：

1. **「Never show a spinner where a thumbhash can go」** — 打开 viewer 瞬间背景就是 thumbhash 全屏模糊，不是黑屏转圈
2. **缩略图已在网格解码过 → 跳过淡入**（`disableThumbnailTransition`），点击进入零闪烁
3. **300ms 延迟后才出现右下角玻璃进度条**（`42% · 3.2/8.4MB`），不是全屏 spinner
4. **只下载当前张原图**，相邻张只显示缩略图
5. **10 张 LRU blob 缓存** — 返回刚才看过的秒开
6. **原图失败 → 保留缩略图 + 错误玻璃条**，绝不空白

**与 WebGL 的衔接（Afilmory 同款）：** 阶段 B 用 `<img>` 保证即时上屏；阶段 C 的 blob 就绪后挂载 WebGL `ImageViewer`，首帧渲染完成才卸载缩略图 — 缩略图层只是 WebGL 就绪前的视觉替身。

实现文件：

| 文件 | 职责 |
|------|------|
| `src/web/modules/viewer/ProgressiveImage.tsx` | 三级状态机 |
| `src/web/modules/viewer/hooks.ts` | `useProgressiveImageState` / `useImageLoader` |
| `src/web/lib/image-loader-manager.ts` | XHR 进度 + LRU cache |
| `src/web/modules/inspector/LoadingIndicator.tsx` | 玻璃进度条（300ms 延迟） |

**网格单元格**（`MasonryPhotoItem`）：Thumbhash 立即上屏 → 800w 懒加载叠上 → hover 显示 EXIF 渐变浮层（焦距/光圈/快门/ISO 四宫格）。单元格高度 `width / aspectRatio` 预定，图片加载不触发 reflow。

### 5.1b WebGL / WebGPU 图片渲染（新增）

> 推翻早期「暂不使用 WebGL」决策。原图 8574×5716（约 20MB），CSS `transform: scale()` 放大会糊；GPU 渲染 + LOD 在 10–20x 仍锐利，且平移有惯性手感。

**移植来源：** Afilmory `packages/webgl-viewer`（约 4200 行，React 19 组件 + 双引擎）。

| 能力 | 说明 | 对 Lumen 的价值 |
|------|------|----------------|
| **LOD 瓦片** | 在 Worker 中从原图解码，生成概览 + 可见区瓦片；LOD 随缩放/DPR 变化 | 放大看细节不糊；**无需服务端预切片** |
| **WebGPU 优先 + WebGL 降级** | `navigator.gpu` 探测；失败/设备丢失时切 WebGL，保留缩放平移位置 | 兼容性 + 体验连续 |
| **纹理预算** | 128 MiB 上限（不含 CPU 解码/画布/驱动内存） | 大图不炸显存 |
| **HDR Gain Map** | 支持 Adobe XMP / ISO 21496-1 增益图，着色器还原 HDR（Display P3 / `rgba16float`） | 有增益图的照片真 HDR；无则 SDR |
| **手势引擎** | 滚轮/捏合/双击/拖拽 + 惯性平移 + 对齐动画；`limitToBounds` / `centerOnInit` | 比 CSS transform 手感好一个档次 |
| **视口状态** | `ImageViewportState`（scale/translate/fitToScreen…） | 供 EXIF 区域标注、缩放 HUD 共用 |

**接口形态（对齐 Afilmory）：**

```tsx
<ImageViewer
  src={blobUrl}                 // 原图 blob（阶段 C）
  width={photo.width} height={photo.height}
  minScale={1} maxScale={20}
  onLoad={() => setHighResRendered(true)}   // 首帧后卸载缩略图
  onError={fallbackToThumbnail}
  onHDRChange={setHdr}
  onZoomChange={(scale) => setScaleHud(scale)}
/>
```

**降级策略：**

1. WebGPU 初始化失败 / 设备丢失 → 自动切 WebGL，保留视口
2. WebGL 也不可用（极老设备）→ 退回 `<img>` + CSS transform（Phase 2 的缩略图路径复用）
3. HDR 不支持 / 增益图无效 → 按 SDR 显示

**移植/裁剪建议：**

- 保留：`ImageViewerEngineBase`（手势/物理）、`WebGLImageViewerEngine`、`shaders.ts`、`webgl` LOD 瓦片
- 保留：`jpeg-gainmap.ts`（用户照片若带增益图可直接受益）
- 可延后：`WebGPUImageViewerEngine` + `webgpu-texture.worker.ts`（WebGL-only 先跑通，WebGPU 作增强）
- 可删：`DebugInfo.tsx` 调试面板（生产不需要，开发期可留）
- 路径：`src/web/modules/viewer/webgl-viewer/`（内联为子模块，不发 npm 包）

**验证点：** 20MB 原图放大到 10x 仍锐利；平移有惯性；缩放 HUD 数字平滑；WebGL 被禁用时自动降级不白屏。

### 5.2 标签筛选瀑布流重组（痛点 2）

Afilmory 本身**没有**做 filter 重组动画（硬重布局）。这是本项目额外要求，用 **GSAP Flip**：

```
筛选变化 → 计算新 filtered 列表
  → Flip.getState(所有可见卡片)
  → 更新 masonic items（同一 Masonry 实例，不 remount）
  → Flip.from(state, { duration: 0.45, ease: 'power2.inOut', stagger: 0.02, absolute: true })
  → 新进场卡片 fade+scale in，离场卡片 fade out
```

要解决的现有硬伤：

- **删掉** `shrunk ? key={Date.now()}` 重挂逻辑，改成 masonic `reposition()` + Flip
- 搜索框补 `type="search"` / `aria-label` / 清除按钮（现有技术债一并清）
- 筛选时 viewer 索引钳制（沿用现有逻辑）

实现文件：`src/web/modules/gallery/AnimatedMasonry.tsx`、`src/web/modules/tags/TagBrowser.tsx`

### 5.3 手机端双列/单列切换（痛点 3）

- **默认手机双列**：列宽目标 150px（Afilmory `COLUMN_WIDTH_CONFIG.auto.mobile`），390px 手机自然排 2 列
- **切换控件**：画廊右下角悬浮按钮（1 列 ↔ 2 列 ↔ 自动），存 `localStorage`
- **桌面端**：自动列宽（250px 目标，上限 8 列）+ 可选列数滑杆（3–8）
- 修复现有骨架屏 `grid-cols-2` 与 masonry 不一致的 CLS

### 5.4 EXIF 面板（痛点 4）

对齐 Afilmory `PhotoInspector` / `MobilePhotoInspectorSheet`：

| 端 | 形态 | 默认 |
|----|------|------|
| PC `≥1024px` | 右侧滑入面板（`w-80`，玻璃拟态），图片区自动让位 | **默认展开**，可关闭 |
| 手机 `<1024px` | 底部抽屉（`rounded-t-[28px]`），上滑/点 info 打开 | **默认收起** |

分区：

1. **基本信息** — 文件名、格式、尺寸、大小、拍摄时间（补 `OffsetTimeOriginal` 时区修正）
2. **拍摄参数** — 焦距/光圈/快门/ISO 芯片式
3. **设备信息** — 相机、镜头
4. **标签** — 可点击，跳转 `/tags`
5. **GPS**（若有则模糊化后展示）

废除 PhotoViewer 内联 CSS 和 `[...slug].astro` 的重复 sidebar，统一为一个 `ExifPanel` 组件。

---

## 6. 数据与加载

- `photos.json` 用 Vite `import photos from '../../public/photos.json'` **构建期内联**（203 张约 300KB，免一次网络请求，首屏即出）
- 前端零排序（契约：数组顺序 = 展示顺序，构建时已按 `exif.dateTime` 降序）
- `Photo` 类型补 `aspectRatio`（`width/height` 推导）供 masonic 预定尺寸
- `photos.json` 字段契约不变（`id/key/filename/size/format/lastModified/width/height/exif/thumbHash/thumbnail/original/tags`）

---

## 7. 部署：Cloudflare Workers

```jsonc
// wrangler.jsonc
{
  "name": "lumen-gallery",
  "compatibility_date": "2026-10-01",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"   // /photos/:id 深链回落 index.html
  }
}
```

| 项 | 值 |
|----|-----|
| 构建链 | `pnpm install && pnpm process-images:r2 && pnpm build && wrangler deploy` |
| 站点域名 | `gallery.echorains.top`（挂 Workers） |
| 图片域名 | `photos.echorains.top`（R2 自定义域，不变） |
| R2 密钥 | `wrangler secret put` 或构建机 env（不再用 Netlify UI） |
| SEO | 首版接受 SPA 客户端渲染；`/photos/:id` 的 OG meta 后续用 Worker `HTMLRewriter` 注入 |

**注意：** 静态 Astro 站点不要加 SPA/角色条件 redirect 的教训对 Workers 不适用——Workers Static Assets 原生支持 `not_found_handling: "single-page-application"`。

---

## 8. 复用清单（不要重写）

| 路径 | 处理 |
|------|------|
| `src/lib/storage/**` | 原样保留 |
| `src/lib/image/**` | 原样保留（仅 `exif.ts` 补 `OffsetTimeOriginal`） |
| `scripts/build-images.ts` / `build-images-r2.ts` | 原样保留 |
| `src/types/photo.ts` | 保留，补 `aspectRatio` |
| `src/consts.ts` | 保留 |
| `MasonicGallery` 的 ThumbHash 解码、PhotoCard 交互 | 逻辑迁入新组件 |
| `PhotoViewer` 缩放/键盘/胶片条规则 | 逻辑迁入新组件 |
| `TagBrowser` 过滤逻辑 | 逻辑迁入新组件 |
| `docs/AFILMORY_LEARNINGS.md` 防坑清单 | 实现时逐条对照 |

---

## 9. 明确不做（YAGNI）

- ~~WebGL / WebGPU 渲染器~~ — **2026-10-13 撤销，已加入计划**（见 §5.1b）
- 服务端预切片 / 云图片处理（LOD 瓦片在客户端从原图生成）
- 多尺寸缩略图 / srcset（维持 2026-05-27 决定）
- 博客 / RSS / sitemap
- 用户上传 / API Routes
- 暗色模式、分享、地图（原 P1/P2，重写完成后再说）
- SSR / 预渲染（首版 SPA + Workers 静态资源）
- 相邻张原图预取（Afilmory 也不做）
- 3D 相册 / WebGL 特效页（与查看器渲染无关的花活）

---

## 10. 实施阶段

### Phase 0 — 脚手架 + 部署打通
1. `vite.config.ts` + `index.html` + `src/web/main.tsx` + react-router 空路由
2. `wrangler.jsonc`，`wrangler dev` 本地跑通
3. 从 `package.json` 移除 Astro 依赖，保留 pipeline 依赖（sharp/exifr/thumbhash/aws-sdk/tsx）
4. 验证 `pnpm process-images:r2 && pnpm build` 全链路

### Phase 1 — 数据层 + 画廊网格
1. 内联 `photos.json`，`Photo` 类型对齐，Zustand `galleryStore`
2. `MasonryView` + `MasonryPhotoItem`（Thumbhash + 800w 懒加载 + 预定尺寸）
3. 手机默认双列 + `ColumnToggle` 切换
4. 复用 `src/consts.ts` 做 Header/侧栏站点信息

### Phase 2 — Viewer 渐进加载（核心体验）
1. `ProgressiveImage` 三级状态机 + `ImageLoaderManager`（XHR 进度 + LRU）
2. `LoadingIndicator` 玻璃进度条（300ms 延迟）
3. 共享元素进入动画（motion：grid 单元格 → viewer frame，0.42s）
4. 胶片条（`@tanstack/react-virtual`）+ 键盘导航
5. URL 同步：`/photos/:id`，`history.pushState` 在 `setState` **之后**
6. 阶段 C 渲染面临时用 `<img>` + CSS transform（为 Phase 3 铺路，接口先对齐 `ImageViewer` props）

### Phase 3 — WebGL / WebGPU 渲染面（新增）
> 对应 §5.1b。移植 Afilmory `packages/webgl-viewer`。

1. 抽出 `ImageViewerEngineBase`（手势/物理/视口状态）→ `src/web/modules/viewer/webgl-viewer/`
2. 移植 `WebGLImageViewerEngine` + `shaders.ts` + LOD 瓦片生成（Worker 中从 blob 解码）
3. 把 Phase 2 的 `<img>` 渲染面换成 `<ImageViewer src={blobUrl} />`，首帧 `onLoad` 后卸载缩略图
4. 缩放 HUD（复用 `onZoomChange`）+ 平移惯性手感调参
5. 三级降级：WebGPU → WebGL → `<img>` CSS transform
6. （可选）`jpeg-gainmap.ts` HDR 支持；（可选）WebGPU 引擎 + texture worker
7. 验证：20MB 原图放大 10x 仍锐利、纹理预算不超、降级不白屏

### Phase 4 — EXIF 面板
1. 统一 `ExifPanel` 组件
2. PC 右侧默认展开 / 手机底部抽屉默认收起
3. 补 `OffsetTimeOriginal` 时区修正（`src/lib/image/exif.ts` 小改）
4. 基本信息 / 拍摄参数 / 设备 / 标签 / GPS 分区
5. （可选）区域标注 overlay — 复用 `ImageViewportState` 与 WebGL 同一视口

### Phase 5 — 标签筛选 + GSAP Flip 重组
1. `TagBrowser`：搜索 + 多选标签（沿用过滤逻辑）
2. `AnimatedMasonry`：GSAP Flip 重组动画，删掉 remount hack
3. 筛选时 viewer 索引钳制

### Phase 6 — 收尾 + 清理
1. `/about` 简单页（用 `AUTHOR_INFO`）
2. 移除全部 Astro 文件、blog 占位、`netlify` 相关
3. 深链 / 刷新 / 浏览器前进后退 通测
4. 手机手势回归（iOS `touchmove` passive:false、300ms 双击、pinch-zoom 与 swipe 互斥）
5. 更新 `docs/CONTEXT.md` / `DECISIONS.md` / `TODO.md` / `CLAUDE.md`

---

## 11. 验证清单

1. `pnpm process-images` 本地出 `photos.json`
2. `pnpm dev` — Chrome + 手机模拟器逐条过：
   - [ ] 网格滚动：thumbhash 先上、缩略图淡入、无布局跳动
   - [ ] 点击进入：无黑屏 spinner，thumbhash 背景 → 缩略图 → 进度条 → 原图
   - [ ] 快速切张：相邻张只有缩略图，当前张才拉原图；返回刚才看过的秒开（LRU）
   - [ ] **WebGL：20MB 原图放大 10x 仍锐利（LOD 生效）；平移有惯性；缩放 HUD 平滑**
   - [ ] **WebGL 降级：禁用 GPU / 老浏览器 → 自动退回 `<img>`，不白屏**
   - [ ] 标签筛选：卡片 FLIP 重组动画，无闪断
   - [ ] 手机：默认双列、可切单列；EXIF 默认收起，底部抽屉；双指缩放/双击
   - [ ] PC：EXIF 右侧默认展开；`/photos/:id` 直链刷新可用；前进后退正确
3. `pnpm build && wrangler dev` — 产物可跑
4. `wrangler deploy` — `gallery.echorains.top` 深链不 404
5. 故意断网 / 404 原图 — 降级到缩略图 + 错误提示，不白屏

---

## 12. 风险与注意

| 风险 | 应对 |
|------|------|
| **webgl-viewer 移植量大（~4200 行）** | 分步：先 WebGL-only 跑通，再加 WebGPU/gainmap；接口对齐 Afilmory 便于对照移植 |
| **WebGL 在 iOS Safari 的兼容** | 需真机测纹理上限；失败自动降级 `<img>`；`touchmove` 走引擎统一处理 |
| **大图纹理内存** | 沿用 Afilmory 128 MiB 预算 + LOD 裁剪；8574×5716 RGBA 约 190MB 原始 → 必须走瓦片/降采样 |
| photos.json 内联体积 | 203 张约 300KB 可接受；上千张时改为 `fetch` + 缓存 |
| masonic + GSAP Flip | masonic 用 `transform` 定位，Flip 需 `absolute: true`；不稳则退化为 motion `layout` |
| iOS Safari | `touchmove` 阻止必须 `{ passive: false }`；双击用 300ms 判定 |
| 构建顺序 | 图片流水线不进 `vite build`，必须先 `process-images` 再 `build` |
| `tsc` 本仓库不可用 | 验证以 `pnpm build` + 手测为准 |
| history 时序 | `setState` 先于 `history.pushState`，否则 popstate 竞争 |
| 事件监听器 | 每个 `addEventListener` 必须有匹配 `removeEventListener`，函数引用一致 |
| pinch-zoom 与 swipe 互斥 | `scale > 1` 时禁用 slide 切换（AFILMORY_LEARNINGS §3） |

---

## 13. 相关文档

- `docs/AFILMORY_LEARNINGS.md` — Afilmory 防坑清单（实现时逐条对照）
- `docs/DECISIONS.md` — 历史 ADR（本设计推翻 2026-05-25「继续 Astro」与 Netlify 部署决策）
- `docs/CONTEXT.md` — 当前开发上下文
- 计划全文：`~/.claude/plans/pasted-content-id-d2d6-1-astro-afilmory-partitioned-horizon.md`（会话计划，实施时以本文档为准）
