import sharp from "sharp"
import { encode } from "blurhash"
import type { ProcessImageOptions, ThumbnailInfo } from "./types"

/**
 * 生成单个缩略图
 */
export async function generateThumbnail(
  buffer: Buffer,
  size: number,
  options: { format?: "jpg" | "webp"; quality?: number } = {}
): Promise<{ buffer: Buffer; info: ThumbnailInfo }> {
  const format = options.format || "jpg"
  const quality = options.quality || 85

  const sharpInstance = sharp(buffer)

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
 * 生成 Blurhash
 * @param buffer 图片 Buffer
 * @param components X和Y方向的组件数量 (4-9)
 */
export async function generateBlurhash(buffer: Buffer, components: number = 4): Promise<string> {
  // 缩小图片以加快编码速度
  const image = sharp(buffer).resize(32, 32, { fit: "inside" })

  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  return encode(new Uint8ClampedArray(data), info.width, info.height, components, components)
}

/**
 * 转换 HEIC/HEIF/TIFF 格式到 JPEG
 */
export async function convertImage(buffer: Buffer, targetFormat: "jpg" | "png" | "webp" | "avif" = "jpg", quality: number = 90): Promise<Buffer> {
  const sharpInstance = sharp(buffer)

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
 * 获取图片尺寸
 */
export async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  const metadata = await sharp(buffer).metadata()
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  }
}
