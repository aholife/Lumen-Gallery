import exifr from "exifr"
import type { ImageExifData } from "./types"

/**
 * 提取图片 EXIF 信息
 */
export async function extractExif(buffer: Buffer): Promise<ImageExifData> {
  try {
    const exifData = await exifr.parse(buffer, {
      // 指定要提取的字段
      pick: [
        "Make",
        "Model",
        "Software",
        "DateTime",
        "DateTimeOriginal",
        "Orientation",
        "ExposureTime",
        "FNumber",
        "ISO",
        "FocalLength",
        "LensModel",
        "GPSLatitude",
        "GPSLongitude",
        "GPSAltitude",
        "ImageWidth",
        "ImageHeight",
        "latitude",
        "longitude",
      ],
    })

    if (!exifData) {
      return {}
    }

    const result: ImageExifData = {
      make: exifData.Make,
      model: exifData.Model,
      software: exifData.Software,
      dateTime: exifData.DateTimeOriginal || exifData.DateTime,
      orientation: exifData.Orientation,
      exposureTime: exifData.ExposureTime,
      fNumber: exifData.FNumber,
      iso: exifData.ISO,
      focalLength: exifData.FocalLength,
      lensModel: exifData.LensModel,
      width: exifData.ImageWidth,
      height: exifData.ImageHeight,
    }

    // 处理 GPS 信息
    if (exifData.latitude !== undefined && exifData.longitude !== undefined) {
      result.gps = {
        latitude: exifData.latitude,
        longitude: exifData.longitude,
        altitude: exifData.GPSAltitude,
      }
    }

    return result
  } catch (error) {
    console.warn("Failed to extract EXIF:", error)
    return {}
  }
}

/**
 * 格式化曝光时间为可读字符串
 * @param exposureTime 曝光时间（秒）
 * @returns 格式化后的字符串，如 "1/250s"
 */
export function formatExposureTime(exposureTime?: number): string {
  if (!exposureTime) return "N/A"

  if (exposureTime >= 1) {
    return `${exposureTime.toFixed(1)}s`
  }

  const fraction = 1 / exposureTime
  return `1/${Math.round(fraction)}s`
}

/**
 * 格式化光圈值
 * @param fNumber 光圈值
 * @returns 格式化后的字符串，如 "f/2.8"
 */
export function formatAperture(fNumber?: number): string {
  if (!fNumber) return "N/A"
  return `f/${fNumber.toFixed(1)}`
}

/**
 * 格式化焦距
 * @param focalLength 焦距（mm）
 * @returns 格式化后的字符串，如 "50mm"
 */
export function formatFocalLength(focalLength?: number): string {
  if (!focalLength) return "N/A"
  return `${Math.round(focalLength)}mm`
}

/**
 * 格式化 ISO
 * @param iso ISO值
 * @returns 格式化后的字符串，如 "ISO 100"
 */
export function formatISO(iso?: number): string {
  if (!iso) return "N/A"
  return `ISO ${iso}`
}

/**
 * 获取相机全称
 * @param make 制造商
 * @param model 型号
 * @returns 格式化后的字符串
 */
export function getCameraName(make?: string, model?: string): string {
  if (!make && !model) return "Unknown Camera"
  if (!make) return model || "Unknown"
  if (!model) return make

  // 避免重复
  if (model.toLowerCase().startsWith(make.toLowerCase())) {
    return model
  }

  return `${make} ${model}`
}
