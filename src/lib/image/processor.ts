import sharp from "sharp"
import { rgbaToThumbHash } from "thumbhash"
import type { ProcessImageOptions, ThumbnailInfo } from "./types"

/**
 * 生成单个缩略图
 */
export async function generateThumbnail(
  buffer: Buffer,
  size: number,
  options: { format?: "jpg" | "webp"; quality?: number } = {}
): Promise<{ buffer: Buffer; info: ThumbnailInfo }> {
  const format = options.format || "webp"
  const quality = options.quality || 85

  const sharpInstance = sharp(buffer)
    .rotate() // 自动根据 EXIF Orientation 旋转

  // 调整大小（保持宽高比）
  sharpInstance.resize(size, size, {
    fit: "inside",
    withoutEnlargement: true,
  })

  // 转换格式
  if (format === "webp") {
    sharpInstance.webp({ quality })
  } else {
    sharpInstance.jpeg({ quality, mozjpeg: true })
  }

  const outputBuffer = await sharpInstance.toBuffer()
  const metadata = await sharp(outputBuffer).metadata()

  return {
    buffer: outputBuffer,
    info: {
      url: "", // 需要后续填充
      width: metadata.width || 0,
      height: metadata.height || 0,
      size: outputBuffer.length,
    },
  }
}

/**
 * 生成多个尺寸的缩略图
 */
export async function generateThumbnails(
  buffer: Buffer,
  sizes: number[] = [300, 800, 1600],
  options: { format?: "jpg" | "webp"; quality?: number } = {}
): Promise<Map<number, { buffer: Buffer; info: ThumbnailInfo }>> {
  const thumbnails = new Map()

  for (const size of sizes) {
    const thumbnail = await generateThumbnail(buffer, size, options)
    thumbnails.set(size, thumbnail)
  }

  return thumbnails
}

/**
 * 生成 ThumbHash
 * ThumbHash 比 BlurHash 体积更小、质量更高，且支持透明度
 * @param buffer 图片 Buffer
 * @returns Base64 编码的 ThumbHash 字符串
 */
export async function generateThumbHash(buffer: Buffer): Promise<string> {
  // 缩小图片以加快编码速度（ThumbHash 推荐 100x100 以内）
  const { data, info } = await sharp(buffer)
    .resize(100, 100, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const thumbHash = rgbaToThumbHash(info.width, info.height, data)
  // 转为 Base64 字符串便于 JSON 存储和前端传输
  return Buffer.from(thumbHash).toString("base64")
}

/**
 * 转换 HEIC/HEIF/TIFF 格式到 JPEG
 */
export async function convertImage(buffer: Buffer, targetFormat: "jpg" | "png" | "webp" | "avif" = "jpg", quality: number = 90): Promise<Buffer> {
  const sharpInstance = sharp(buffer).rotate() // 自动根据 EXIF 旋转

  switch (targetFormat) {
    case "jpg":
      return await sharpInstance.jpeg({ quality, mozjpeg: true }).toBuffer()
    case "png":
      return await sharpInstance.png({ quality }).toBuffer()
    case "webp":
      return await sharpInstance.webp({ quality }).toBuffer()
    case "avif":
      return await sharpInstance.avif({ quality }).toBuffer()
    default:
      throw new Error(`Unsupported format: ${targetFormat}`)
  }
}

/**
 * 检测图片格式
 */
export async function detectImageFormat(buffer: Buffer): Promise<string> {
  const metadata = await sharp(buffer).metadata()
  return metadata.format || "unknown"
}

/**
 * 获取图片尺寸（考虑 EXIF 旋转后的实际尺寸）
 */
export async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  const metadata = await sharp(buffer).metadata()
  const orientation = metadata.orientation || 1
  const width = metadata.width || 0
  const height = metadata.height || 0

  // Orientation 5-8 表示图片需要旋转 90°/270°，宽高需要互换
  if (orientation >= 5 && orientation <= 8) {
    return { width: height, height: width }
  }
  return { width, height }
}
