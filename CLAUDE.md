# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lumen Gallery is a personal photo gallery static site built with **Astro 5 + React Islands**. It uses a storage abstraction layer (Local / Cloudflare R2 / GitHub) and a build-time image processing pipeline that generates thumbnails, EXIF metadata, and ThumbHash placeholders.

Documentation in `/docs/` is written in Chinese. The project has no lint or test tooling configured.

## Commands

```bash
pnpm install              # Install dependencies
pnpm dev                  # Dev server at localhost:4321
pnpm build                # Build static site to dist/
pnpm build:full           # Process images (local) + build
pnpm build:r2             # Process images (R2) + build
pnpm preview              # Preview built site
pnpm process-images       # Process photos from public/photos/ (local mode)
pnpm process-images:r2    # Download from R2, process, upload back
```

There are **no lint, test, or format commands** in this project.

## Architecture

### Storage Abstraction (`src/lib/storage/`)

Factory pattern with a `StorageProvider` interface. Three backends: `local.ts`, `r2.ts`, `github.ts`. Selected via `STORAGE_MODE` env var. Config and env loading in `config.ts` and `index.ts`.

### Image Processing Pipeline (`src/lib/image/`)

Build-time only. Sharp-based processing in `processor.ts`: HEIC/TIFF → JPEG conversion, 800px WebP thumbnails, ThumbHash placeholder generation. EXIF extraction via `exifr` in `exif.ts`. Tags are extracted from directory structure. Two entry points: `index.ts` (local) and `index-r2.ts` (R2). Output is `public/photos.json` — the sole data contract consumed by the frontend.

### React Islands (frontend)

Interactive components use `client:only="react"` in Astro pages:

- **`GalleryWithViewer.tsx`** — State container that owns the photo list, viewer open/close state, and URL hash sync. Renders `MasonicGallery` and `PhotoViewer`.
- **`MasonicGallery.tsx`** — Masonry/waterfall layout via `masonic`. Receives `onClick` callbacks.
- **`PhotoViewer.tsx`** — Full-screen viewer with filmstrip (`@tanstack/react-virtual`), zoom, and keyboard navigation.
- **`TagBrowser.tsx`** — Tag search + multi-select filtering, renders its own `MasonicGallery`.

### Key Data Flow

```
public/photos/*  →  scripts/build-images*.ts  →  public/photos.json  →  Astro SSG pages  →  React islands
```

`photos.json` contains an array of `Photo` objects (type defined in `src/types/photo.ts`). The gallery page and tag page both load this file at build time.

### Storage Config (`STORAGE_MODE` env var)

See `.env.example` for all variables. Modes: `local` (reads from `LOCAL_BASE_PATH`), `r2` (uses `R2_*` vars), `github` (uses `GITHUB_*` vars).

## Key Conventions

- TypeScript strict mode (`astro/tsconfigs/strict`)
- ESM throughout (`"type": "module"`)
- Tailwind CSS v4 via `@tailwindcss/vite` plugin
- Package manager is **pnpm**
- `public/photos/` and `public/processed/` are gitignored — raw photos are not committed
