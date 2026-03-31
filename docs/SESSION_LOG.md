# AI 协作会话日志

> 记录每次与 AI 协作开发的摘要，便于复盘和追溯。
> 新的记录追加到最上方。

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
