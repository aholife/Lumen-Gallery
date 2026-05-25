/**
 * 共享的图片类型定义
 * 对齐 photos.json 的实际数据结构
 */

/** EXIF 拍摄参数 */
export interface PhotoExif {
  make?: string
  model?: string
  software?: string
  dateTime?: string
  exposureTime?: number
  fNumber?: number
  iso?: number
  focalLength?: number
  lensModel?: string
  gps?: {
    latitude: number
    longitude: number
    altitude?: number
  }
}

/** 图片尺寸信息 */
export interface PhotoSizeInfo {
  url: string
  width: number
  height: number
  size: number
}

/** 图片元数据 — 对齐 photos.json 输出格式 */
export interface Photo {
  id: string
  key: string
  filename: string
  size: number
  format: string
  lastModified: string
  width: number
  height: number
  exif?: PhotoExif
  thumbHash: string
  thumbnail: PhotoSizeInfo
  original: PhotoSizeInfo
  tags?: string[]
}
