/**
 * 图片元数据类型定义
 */

export interface ImageExifData {
  // 基础信息
  make?: string // 相机制造商
  model?: string // 相机型号
  software?: string // 软件
  dateTime?: Date // 拍摄时间
  orientation?: number // 方向

  // 拍摄参数
  exposureTime?: number // 曝光时间（秒）
  fNumber?: number // 光圈值
  iso?: number // ISO感光度
  focalLength?: number // 焦距（mm）
  lensModel?: string // 镜头型号

  // GPS信息
  gps?: {
    latitude: number
    longitude: number
    altitude?: number
  }

  // 图片尺寸
  width?: number
  height?: number
}

export interface ImageMetadata {
  id: string // 唯一标识符 (通常等于 key)
  // 文件信息
  key: string // 原始文件路径
  filename: string // 文件名
  size: number // 文件大小（字节）
  format: string // 格式 (jpg, png, heic 等)
  lastModified: Date

  // 图片尺寸
  width: number
  height: number

  // EXIF 数据
  exif: ImageExifData

  // Blurhash 占位符
  blurhash: string

  // 生成的缩略图
  thumbnails: {
    small: ThumbnailInfo // 300px
    medium: ThumbnailInfo // 800px
    large: ThumbnailInfo // 1600px 
  }
  Original?: ThumbnailInfo // 原图信息

  // 标签（从目录结构提取）
  tags: string[]
}

export interface ThumbnailInfo {
  url: string // 访问URL
  width: number
  height: number
  size: number // 文件大小（字节）
}

export interface ProcessImageOptions {
  // 缩略图尺寸
  thumbnailSizes?: number[]
  // Blurhash 组件数量 (4-9)
  blurhashComponents?: number
  // 输出格式
  outputFormat?: "jpg" | "webp"
  // 输出质量 (1-100)
  quality?: number
  // 是否保留原图
  keepOriginal?: boolean
}
