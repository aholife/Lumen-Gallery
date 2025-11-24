import type { StorageProvider, FileMeta } from "./types"

interface GitHubFile {
  name: string
  path: string
  sha: string
  size: number
  type: "file" | "dir"
  download_url?: string
}

/**
 * GitHub 仓库存储实现
 * 通过 GitHub API 读取仓库中的图片
 */
export class GitHubStorage implements StorageProvider {
  private owner: string
  private repo: string
  private branch: string
  private path: string
  private token?: string

  constructor(config: { owner: string; repo: string; branch?: string; path?: string; token?: string }) {
    this.owner = config.owner
    this.repo = config.repo
    this.branch = config.branch || "main"
    this.path = config.path || ""
    this.token = config.token
  }

  /**
   * 递归列出仓库中的所有图片文件
   */
  async listFiles(prefix?: string): Promise<FileMeta[]> {
    const targetPath = prefix ? `${this.path}/${prefix}`.replace(/^\/+/, "") : this.path
    const files: FileMeta[] = []

    async function scanDirectory(owner: string, repo: string, path: string, token?: string, branch?: string): Promise<void> {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
      const headers: HeadersInit = {
        Accept: "application/vnd.github.v3+json",
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch(url, { headers })
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
      }

      const items: GitHubFile[] = await response.json()

      for (const item of items) {
        if (item.type === "dir") {
          // 递归扫描子目录
          await scanDirectory(owner, repo, item.path, token, branch)
        } else if (item.type === "file") {
          // 检查是否是图片文件
          const ext = item.name.toLowerCase().split(".").pop()
          if (["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "tiff", "tif"].includes(ext || "")) {
            files.push({
              key: item.path,
              lastModified: new Date(), // GitHub API 不直接提供修改时间，需要额外请求
              size: item.size,
              etag: item.sha,
            })
          }
        }
      }
    }

    await scanDirectory(this.owner, this.repo, targetPath, this.token, this.branch)
    return files
  }

  /**
   * 下载文件内容
   */
  async downloadFile(key: string): Promise<Buffer> {
    const url = `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/${key}`

    const headers: HeadersInit = {}
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    const response = await fetch(url, { headers })
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  /**
   * 获取公共访问URL（GitHub raw URL）
   */
  getPublicUrl(key: string): string {
    return `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/${key}`
  }
}
