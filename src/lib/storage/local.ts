import { readdir, readFile, writeFile, stat } from "fs/promises"
import { join, relative } from "path"
import type { StorageProvider, FileMeta } from "./types"

/**
 * 本地文件系统存储实现
 * 用于开发和小型项目，直接读取本地目录中的图片
 */
export class LocalStorage implements StorageProvider {
  private basePath: string
  private publicPath: string

  constructor(config: { basePath: string; publicPath?: string }) {
    this.basePath = config.basePath
    // 用于生成访问URL的公共路径（如 /images/）
    this.publicPath = config.publicPath || "/images/"
  }

  /**
   * 递归列出所有文件
   * @param prefix 子目录前缀（相对于 basePath）
   */
  async listFiles(prefix?: string): Promise<FileMeta[]> {
    const targetDir = prefix ? join(this.basePath, prefix) : this.basePath
    const files: FileMeta[] = []

    async function scanDir(dir: string, baseDir: string): Promise<void> {
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dir, entry.name)

        if (entry.isDirectory()) {
          // 递归扫描子目录
          await scanDir(fullPath, baseDir)
        } else if (entry.isFile()) {
          // 检查是否是图片文件
          const ext = entry.name.toLowerCase().split(".").pop()
          if (["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "tiff", "tif"].includes(ext || "")) {
            const stats = await stat(fullPath)
            // 生成相对路径作为 key
            const key = relative(baseDir, fullPath).replace(/\\/g, "/")

            files.push({
              key,
              lastModified: stats.mtime,
              size: stats.size,
            })
          }
        }
      }
    }

    await scanDir(targetDir, this.basePath)
    return files
  }

  /**
   * 读取文件内容
   */
  async downloadFile(key: string): Promise<Buffer> {
    const filePath = join(this.basePath, key)
    return await readFile(filePath)
  }

  /**
   * 上传/写入文件（可选功能）
   */
  async uploadFile(key: string, body: Buffer | Uint8Array | string): Promise<void> {
    const filePath = join(this.basePath, key)
    // 处理 Buffer 类型转换
    const data = Buffer.isBuffer(body) ? new Uint8Array(body) : body
    await writeFile(filePath, data)
  }

  /**
   * 获取公共访问URL
   */
  getPublicUrl(key: string): string {
    const cleanKey = key.replace(/\\/g, "/").replace(/^\//, "")
    return `${this.publicPath}${cleanKey}`
  }
}
