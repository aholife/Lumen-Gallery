import { writeFile, mkdir } from "fs/promises"
import { join, dirname, basename, extname } from "path"
import type { StorageProvider } from "../storage/types"
import type { ImageMetadata, ProcessImageOptions } from "./types"
import { generateThumbnails, generateThumbnail, generateBlurhash, convertImage, detectImageFormat, getImageDimensions } from "./processor"
import { extractExif } from "./exif"

/**
 * 处理单张图片
 */
export async function processImage(storage: StorageProvider, fileKey: string, outputDir: string, options: ProcessImageOptions = {}): Promise<ImageMetadata> {
  console.log(`Processing: ${fileKey}`)

  // 1. 下载原图
  const originalBuffer = await storage.downloadFile(fileKey)

  // 2. 检测格式
  const format = await detectImageFormat(originalBuffer)
  console.log(`  Format: ${format}`)

  // 3. 转换特殊格式（HEIC/HEIF/TIFF -> JPG）
  let processBuffer = originalBuffer
  const needsConversion = ["heic", "heif", "tiff", "tif"].includes(format.toLowerCase())

  if (needsConversion) {
    console.log("  Converting to JPEG...")
    processBuffer = await convertImage(originalBuffer, "jpg", options.quality || 90)
  }

  // 4. 获取尺寸
  const dimensions = await getImageDimensions(processBuffer)
  console.log(`  Dimensions: ${dimensions.width}x${dimensions.height}`)

  // 5. 提取 EXIF
  console.log("  Extracting EXIF...")
  const exif = await extractExif(originalBuffer)

  // 6. 生成 Blurhash
  console.log("  Generating blurhash...")
  const blurhash = await generateBlurhash(processBuffer, options.blurhashComponents || 4)

  // 7. 生成缩略图
  console.log("  Generating thumbnails...")
  const thumbnailSizes = options.thumbnailSizes || [300, 800, 1600]
  const thumbnails = await generateThumbnails(processBuffer, thumbnailSizes, {
    format: options.outputFormat || "jpg",
    quality: options.quality || 85,
  })

  // 生成原图大小的处理后图片（仅在需要转换格式时）
  let fullImage: { buffer: Buffer; info: import("./types").ThumbnailInfo } | null = null
  
  if (needsConversion) {
    const fullSize = Math.max(dimensions.width, dimensions.height)
    fullImage = await generateThumbnail(processBuffer, fullSize, {
      format: options.outputFormat || "jpg",
      quality: options.quality || 85,
    })
  }

  // 8. 保存文件
  const filename = basename(fileKey, extname(fileKey))
  const fileDir = dirname(fileKey)
  const outputPath = join(outputDir, fileDir)

  // 确保输出目录存在
  await mkdir(outputPath, { recursive: true })

  // 保存缩略图并收集信息
  const thumbnailInfo: Record<string, any> = {}
  const sizeNames = ["small", "medium", "large"]

  for (let i = 0; i < thumbnailSizes.length; i++) {
    const size = thumbnailSizes[i]
    const sizeName = sizeNames[i] || `size${size}`
    const thumbnail = thumbnails.get(size)

    if (thumbnail) {
      const ext = options.outputFormat || "jpg"
      const thumbFilename = `${filename}_${size}w.${ext}`
      const thumbPath = join(outputPath, thumbFilename)

      // 转换 Buffer 为 Uint8Array
      await writeFile(thumbPath, new Uint8Array(thumbnail.buffer))

      // 生成访问URL
      const relativePath = join(fileDir, thumbFilename).replace(/\\/g, "/")
      thumbnailInfo[sizeName] = {
        ...thumbnail.info,
        url: `/processed/${relativePath}`,
      }

      console.log(`  Saved: ${thumbFilename} (${thumbnail.info.size} bytes)`)
    }
  }

  // 保存原图大小图片

  let OriginalImage: import("./types").ThumbnailInfo = { url: "", width: 0, height: 0, size: 0 }
  if (fullImage) {
    const ext = options.outputFormat || "jpg"
    const fullFilename = `${filename}_full.${ext}`
    const fullPath = join(outputPath, fullFilename)

    await writeFile(fullPath, new Uint8Array(fullImage.buffer))

    const relativePath = join(fileDir, fullFilename).replace(/\\/g, "/")
    OriginalImage = {
      ...fullImage.info,
      url: `/processed/${relativePath}`,
    }

    console.log(`  Saved: ${fullFilename} (${fullImage.info.size} bytes)`)
  } else {
    // 不需要转换，直接使用原图
    if (storage.getPublicUrl) {
      const originalUrl = storage.getPublicUrl(fileKey)
      OriginalImage = {
        url: originalUrl,
        width: dimensions.width,
        height: dimensions.height,
        size: originalBuffer.length,
      }
      console.log(`  Using original: ${fileKey}`)
    }
  }

  // 9. 提取标签（从目录路径）
  const tags = extractTagsFromPath(fileKey)

  // 10. 构建元数据
  const metadata: ImageMetadata = {
    key: fileKey,
    filename: basename(fileKey),
    size: originalBuffer.length,
    format: needsConversion ? "jpg" : format,
    lastModified: new Date(),
    width: dimensions.width,
    height: dimensions.height,
    exif,
    blurhash,
    thumbnails: {
      small: thumbnailInfo.small,
      medium: thumbnailInfo.medium,
      large: thumbnailInfo.large,
    },
    Original: OriginalImage,
    tags,
  }

  console.log(`✓ Completed: ${fileKey}\n`)
  return metadata
}

/**
 * 批量处理图片
 */
export async function processImages(storage: StorageProvider, outputDir: string, options: ProcessImageOptions = {}): Promise<ImageMetadata[]> {
  console.log("🖼️  Starting image processing...\n")

  // 获取所有图片文件
  const files = await storage.listFiles()
  console.log(`Found ${files.length} images\n`)

  const results: ImageMetadata[] = []

  // 处理每张图片
  for (const file of files) {
    try {
      const metadata = await processImage(storage, file.key, outputDir, options)
      results.push(metadata)
    } catch (error) {
      console.error(`✗ Failed to process ${file.key}:`, error)
    }
  }

  console.log(`\n✅ Processed ${results.length}/${files.length} images`)
  return results
}

/**
 * 从文件路径提取标签
 * 例如: "photos/travel/japan/tokyo.jpg" -> ["travel", "japan"]
 */
function extractTagsFromPath(filePath: string): string[] {
  const parts = filePath.split("/").filter((part) => {
    // 排除文件名和常见的根目录
    return part && !part.includes(".") && part !== "photos" && part !== "images" && part !== "public"
  })

  return parts
}

/**
 * 保存元数据到 JSON 文件
 */
export async function saveMetadata(metadata: ImageMetadata[], outputPath: string): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, JSON.stringify(metadata, null, 2), "utf-8")
  console.log(`\n💾 Metadata saved to: ${outputPath}`)
}
