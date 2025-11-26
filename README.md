# 🖼️ Lumen Gallery

一个基于 Astro 构建的高性能照片画廊系统，支持多种存储方式、智能图片处理和 EXIF 信息展示。

## ✨ 特性

- 🚀 **超高性能** - 基于 Astro 静态生成，100/100 Lighthouse 性能评分
- 📦 **多存储支持** - 本地文件系统 / Cloudflare R2 / GitHub 仓库
- 🎨 **智能图片处理** - 自动格式转换（HEIC/TIFF）、多尺寸缩略图生成
- 📸 **EXIF 信息提取** - 相机型号、拍摄参数、GPS 位置等完整元数据
- 🌈 **Blurhash 占位符** - 优雅的图片加载体验
- 🏷️ **自动标签系统** - 基于目录结构自动生成标签
- 📱 **响应式设计** - 完美适配各种设备尺寸
- ♿ **SEO 友好** - 规范 URL、OpenGraph 数据、网站地图支持

## 🚀 快速开始

### 安装依赖

```bash
pnpm install
```

### 配置环境

创建 `.env` 文件：

```bash
# 存储方式：local | r2 | github
STORAGE_TYPE=local

# 本地存储配置
LOCAL_PHOTOS_DIR=./public/photos

# Cloudflare R2 配置（可选）
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name

# GitHub 存储配置（可选）
GITHUB_TOKEN=your_github_token
GITHUB_OWNER=your_username
GITHUB_REPO=your_repo_name
GITHUB_BRANCH=main
GITHUB_PHOTOS_PATH=photos
```

### 添加照片

将照片放入 `public/photos/` 目录（或配置的其他目录）：

```bash
public/photos/
  ├── travel/
  │   ├── tokyo/
  │   │   ├── photo1.jpg
  │   │   └── photo2.heic
  │   └── paris/
  │       └── photo3.jpg
  └── daily/
      └── photo4.png
```

### 处理图片

```bash
pnpm process-images
```

这将：
- ✅ 转换 HEIC/TIFF 为 JPEG
- ✅ 生成 300px、800px、1600px 三种尺寸缩略图
- ✅ 提取完整 EXIF 信息
- ✅ 生成 Blurhash 占位符
- ✅ 从目录结构提取标签
- ✅ 输出元数据到 `public/photos.json`

### 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:4321/gallery 查看画廊。

### 构建生产版本

```bash
# 处理图片并构建
pnpm build:full

# 或分步执行
pnpm process-images
pnpm build
```

## 📂 项目结构

```text
├── public/                    # 静态资源
│   ├── photos/               # 原始照片目录
│   ├── processed/            # 处理后的照片
│   └── photos.json          # 照片元数据
├── scripts/
│   └── build-images.ts      # 图片处理脚本
├── src/
│   ├── components/          # UI 组件
│   ├── content/             # Markdown 内容
│   ├── layouts/             # 页面布局
│   ├── lib/
│   │   ├── image/          # 图片处理模块
│   │   │   ├── processor.ts  # Sharp 图片处理
│   │   │   ├── exif.ts       # EXIF 提取
│   │   │   ├── types.ts      # 类型定义
│   │   │   └── index.ts      # 主流程
│   │   └── storage/         # 存储抽象层
│   │       ├── types.ts      # 接口定义
│   │       ├── config.ts     # 配置类型
│   │       ├── index.ts      # 工厂函数
│   │       ├── local.ts      # 本地存储
│   │       ├── r2.ts         # Cloudflare R2
│   │       └── github.ts     # GitHub 存储
│   ├── pages/
│   │   ├── gallery.astro    # 照片画廊页面
│   │   ├── index.astro      # 首页
│   │   └── blog/            # 博客页面
│   └── styles/
│       └── global.css       # 全局样式
├── astro.config.mjs         # Astro 配置
├── package.json
└── tsconfig.json
```

## 🧞 命令列表

| 命令 | 说明 |
| :--- | :--- |
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 启动开发服务器（localhost:4321） |
| `pnpm process-images` | 处理图片并生成元数据 |
| `pnpm build` | 构建生产版本到 `./dist/` |
| `pnpm build:full` | 处理图片 + 构建（推荐） |
| `pnpm preview` | 预览构建后的网站 |
| `pnpm astro ...` | 运行 Astro CLI 命令 |

## 🛠️ 技术栈

| 类别 | 技术 |
| :--- | :--- |
| 框架 | Astro + TypeScript + Tailwind CSS |
| 图片处理 | Sharp（格式转换、缩略图生成） |
| EXIF 提取 | exifr |
| 占位符 | Blurhash |
| 存储 | AWS SDK（S3/R2）、Octokit（GitHub）、Node.js fs |
| 构建工具 | Vite + esbuild |

## 📋 开发计划

### ✅ 第一阶段：基础设施（已完成）
- [x] 项目骨架搭建（Astro + TypeScript）
- [x] 存储抽象层（Local/R2/GitHub）
- [x] 图片处理流水线（Sharp + Exifr + Blurhash）
- [x] 元数据管理系统
- [x] 基础画廊页面

### 🚧 第二阶段：交互增强（进行中）
- [x] 响应式瀑布流布局（Masonic / CSS Grid）
- [ ] 全屏查看器（PhotoSwipe / Swiper.js）
- [ ] 标签筛选和搜索功能
- [ ] 懒加载优化
- [x] Blurhash 占位符展示

### 🔮 第三阶段：高级功能（规划中）
- [ ] 交互式地图浏览器（MapLibre GL JS）
- [ ] GPS 位置展示
- [ ] 图片分享功能（Web Share API）
- [ ] 实况照片（Live Photo）支持
- [ ] PWA 离线支持

### 🚀 第四阶段：优化与部署
- [ ] 性能优化（预加载、CDN）
- [ ] SEO 增强
- [ ] 部署到 Vercel / Netlify / Cloudflare Pages

详细开发计划请参考 [开发计划.md](./开发计划.md)。

## 📚 学习资源

- **[快速开始.md](./快速开始.md)** - 详细的上手指南
- **[项目设置完成.md](./项目设置完成.md)** - 项目配置说明
- **[开发计划.md](./开发计划.md)** - 完整的开发路线图

### 官方文档
- [Astro 文档](https://docs.astro.build)
- [Sharp 文档](https://sharp.pixelplumbing.com/)
- [exifr 文档](https://github.com/MikeKovarik/exifr)
- [Blurhash 文档](https://github.com/woltapp/blurhash)

## 🎯 核心功能说明

### 多存储支持

通过统一的存储接口，轻松切换不同存储方式：

```typescript
interface Storage {
  listFiles(): Promise<FileMeta[]>
  downloadFile(path: string): Promise<Buffer>
}
```

- **本地存储** - 适合开发和小型项目
- **Cloudflare R2** - 高性能对象存储，兼容 S3 API
- **GitHub** - 利用 GitHub 仓库作为免费图床

### 图片处理流程

1. **扫描** - 从配置的存储源读取图片列表
2. **转换** - HEIC/TIFF 自动转为 JPEG 格式
3. **缩略图** - 生成 300px、800px、1600px 三种尺寸
4. **EXIF** - 提取相机型号、拍摄参数、GPS 等信息
5. **Blurhash** - 生成低分辨率占位符
6. **标签** - 从目录路径自动提取（如 `photos/travel/tokyo` → `travel`, `tokyo`）
7. **输出** - 保存处理后的图片和元数据 JSON

### EXIF 信息

自动提取的信息包括：
- 📷 相机品牌和型号
- 🔍 镜头信息
- ⚙️ 拍摄参数（ISO、光圈、快门、焦距）
- 📅 拍摄时间
- 🌍 GPS 位置（经纬度）
- 📏 图片尺寸和方向

## 🔧 已完成的配置

### 存储系统
- ✅ 本地文件系统存储（`src/lib/storage/local.ts`）
- ✅ Cloudflare R2 对象存储（`src/lib/storage/r2.ts`）
- ✅ GitHub 仓库存储（`src/lib/storage/github.ts`）
- ✅ 统一的存储接口抽象

### 图片处理
- ✅ HEIC/TIFF 格式自动转换
- ✅ 多尺寸缩略图生成（300/800/1600px）
- ✅ EXIF 信息完整提取
- ✅ Blurhash 占位符生成
- ✅ 基于目录的自动标签提取
- ✅ 元数据 JSON 输出

### 页面和组件
- ✅ 照片画廊页面（`src/pages/gallery.astro`）
- ✅ 响应式网格布局
- ✅ 无照片时的引导界面
- ✅ 基础博客功能

### 构建脚本
- ✅ 图片批量处理脚本（`scripts/build-images.ts`）
- ✅ npm 命令集成
- ✅ 增量构建支持

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可

MIT License

## 💡 致谢

- 基于 [Astro Blog Template](https://github.com/withastro/astro/tree/main/examples/blog)
- 灵感来源于 [afilmory](https://github.com/Afilmory/afilmory)
