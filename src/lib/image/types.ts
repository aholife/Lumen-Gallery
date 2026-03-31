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

  // ThumbHash 占位符（比 BlurHash 更小更好）
  thumbHash: string

  // 缩略图（单张）
  thumbnail: ThumbnailInfo
  
  // 原图信息
  original: ThumbnailInfo

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
  // 缩略图尺寸（单个值）
  thumbnailSize?: number
  // 输出格式
  outputFormat?: "jpg" | "webp"
  // 输出质量 (1-100)
  quality?: number
}
