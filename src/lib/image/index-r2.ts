import { writeFile, mkdir } from "fs/promises"
import { dirname, basename, extname } from "path"
import { createHash } from "crypto"
import type { StorageProvider } from "../storage/types"
import type { ImageMetadata, ProcessImageOptions } from "./types"
import { generateThumbnail, generateThumbHash, convertImage, detectImageFormat, getImageDimensions } from "./processor"
import { extractExif } from "./exif"

/**
 * R2 专用图片处理 - 缩略图上传到 R2，本地不保存图片
 * 
 * R2 存储结构:
 * your-bucket/
 * ├── photos/           # 原图（用户上传）
 * │   └── cat/
 * │       └── photo.jpg
 * └── thumbnails/       # 缩略图（构建时生成上传）
 *     └── cat/
 *         └── photo_thumb.jpg
 */
export async function processImageR2(
  storage: StorageProvider, 
  fileKey: string, 
  options: ProcessImageOptions = {}
): Promise<ImageMetadata> {
  console.log(`Processing: ${fileKey}`)

  // 检查存储是否支持上传
  if (!storage.uploadFile || !storage.getPublicUrl) {
    throw new Error('R2 storage must support uploadFile and getPublicUrl')
  }

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

  // 6. 生成 ThumbHash
  console.log("  Generating thumbhash...")
  const thumbHash = await generateThumbHash(processBuffer)

  // 7. 生成单张缩略图
  console.log("  Generating thumbnail...")
  const thumbnailSize = options.thumbnailSize || 800
  const ext = options.outputFormat || "webp"
  
  const thumbnail = await generateThumbnail(processBuffer, thumbnailSize, {
    format: ext,
    quality: options.quality || 85,
  })

  // 8. 上传缩略图到 R2
  const filename = basename(fileKey, extname(fileKey))
  const fileDir = dirname(fileKey)
  
  const thumbFilename = `${filename}_thumb.${ext}`
  const r2Key = `thumbnails/${fileDir}/${thumbFilename}`.replace(/\/+/g, '/')
  
  await storage.uploadFile(r2Key, thumbnail.buffer, `image/${ext === 'jpg' ? 'jpeg' : ext}`)
  const thumbnailUrl = storage.getPublicUrl(r2Key)
  console.log(`  ☁️ Uploaded: ${r2Key}`)

  // 9. 处理原图 URL
  let originalImageUrl: string
  let originalSize = originalBuffer.length
  
  if (needsConversion) {
    // 如果需要格式转换，上传转换后的图片
    const fullFilename = `${filename}.${ext}`
    const r2FullKey = `photos/${fileDir}/${fullFilename}`.replace(/\/+/g, '/')
    
    await storage.uploadFile(r2FullKey, processBuffer, `image/${ext === 'jpg' ? 'jpeg' : ext}`)
    originalImageUrl = storage.getPublicUrl(r2FullKey)
    originalSize = processBuffer.length
    console.log(`  ☁️ Uploaded converted: ${r2FullKey}`)
  } else {
    // 直接使用原图 URL
    originalImageUrl = storage.getPublicUrl(fileKey)
    console.log(`  Using original: ${originalImageUrl}`)
  }

  // 10. 提取标签
  const tags = extractTagsFromPath(fileKey)

  // 生成唯一 ID
  const id = createHash('md5').update(fileKey).digest('hex')

  // 11. 构建元数据
  const metadata: ImageMetadata = {
    id,
    key: fileKey,
    filename: basename(fileKey),
    size: originalBuffer.length,
    format: needsConversion ? "jpg" : format,
    lastModified: new Date(),
    width: dimensions.width,
    height: dimensions.height,
    exif,
    thumbHash,
    thumbnail: {
      url: thumbnailUrl,
      width: thumbnail.info.width,
      height: thumbnail.info.height,
      size: thumbnail.info.size,
    },
    original: {
      url: originalImageUrl,
      width: dimensions.width,
      height: dimensions.height,
      size: originalSize,
    },
    tags,
  }

  console.log(`✓ Completed: ${fileKey}\n`)
  return metadata
}

/**
 * 批量处理图片（R2 模式）
 */
export async function processImagesR2(
  storage: StorageProvider, 
  options: ProcessImageOptions = {}
): Promise<ImageMetadata[]> {
  console.log("🖼️  Starting R2 image processing...\n")
  console.log("📡 Mode: Upload thumbnail to R2, no local storage\n")

  const files = await storage.listFiles()
  console.log(`Found ${files.length} images\n`)

  const results: ImageMetadata[] = []

  for (const file of files) {
    try {
      const metadata = await processImageR2(storage, file.key, options)
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
 */
function extractTagsFromPath(filePath: string): string[] {
  const parts = filePath.split("/").filter((part) => {
    return part && !part.includes(".") && part !== "photos" && part !== "images" && part !== "public"
  })
  return parts
}

/**
 * 保存元数据到 JSON 文件（本地）
 */
export async function saveMetadataR2(metadata: ImageMetadata[], outputPath: string): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, JSON.stringify(metadata, null, 2), "utf-8")
  console.log(`\n💾 Metadata saved to: ${outputPath}`)
}
