# 图片目录说明

这个目录用于存放你的照片文件。

## 📁 目录结构建议

```
public/photos/
  ├── 2024/
  │   ├── 01-january/
  │   │   ├── IMG_001.jpg
  │   │   └── IMG_002.jpg
  │   └── 02-february/
  │       └── IMG_003.jpg
  ├── travel/
  │   ├── japan/
  │   │   └── tokyo.jpg
  │   └── europe/
  │       └── paris.jpg
  └── family/
      └── birthday.jpg
```

## 🎨 支持的格式

- **常见格式**: JPG, JPEG, PNG, GIF, WebP
- **RAW 格式**: HEIC, HEIF, TIFF, TIF

## 📝 使用说明

1. **本地开发**: 直接将图片放到此目录
2. **自动标签**: 根据目录结构自动生成标签
   - 例如: `photos/travel/japan/tokyo.jpg` 会自动生成 `travel` 和 `japan` 标签

## 🚀 快速开始

1. 将你的照片拷贝到此目录
2. 运行 `pnpm dev` 查看效果
3. 构建时会自动：
   - 提取 EXIF 信息
   - 生成多尺寸缩略图
   - 创建 blurhash 占位符

## 💡 提示

- 图片文件名建议使用英文或数字
- 目录名称会用作标签，建议使用有意义的名称
- 大文件会在构建时自动优化
