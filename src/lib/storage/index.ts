import { R2Storage } from "./r2"
import { LocalStorage } from "./local"
import { GitHubStorage } from "./github"
import type { StorageProvider } from "./types"
import type { StorageConfig, StorageMode } from "./config"

/**
 * 环境变量获取工具
 * 兼容 Astro (import.meta.env) 和 Node.js (process.env)
 */
const getEnv = (key: string): string => {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key]
  }
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key]
  }
  return ""
}

/**
 * 存储工厂函数
 * 根据配置创建对应的存储实例
 */
export function createStorage(config: StorageConfig): StorageProvider {
  switch (config.mode) {
    case "local":
      if (!config.local) {
        throw new Error('Local storage config is required when mode is "local"')
      }
      return new LocalStorage(config.local)

    case "r2":
      if (!config.r2) {
        throw new Error('R2 storage config is required when mode is "r2"')
      }
      return new R2Storage(config.r2)

    case "github":
      if (!config.github) {
        throw new Error('GitHub storage config is required when mode is "github"')
      }
      return new GitHubStorage(config.github)

    default:
      throw new Error(`Unsupported storage mode: ${config.mode}`)
  }
}

/**
 * 从环境变量加载存储配置
 */
export function loadStorageFromEnv(): StorageProvider {
  const mode = (getEnv("STORAGE_MODE") || "local") as StorageMode

  const config: StorageConfig = { mode }

  switch (mode) {
    case "local":
      config.local = {
        basePath: getEnv("LOCAL_BASE_PATH") || "./public/photos",
        publicPath: getEnv("LOCAL_PUBLIC_PATH") || "/photos/",
      }
      break

    case "r2":
      config.r2 = {
        accountId: getEnv("R2_ACCOUNT_ID"),
        accessKeyId: getEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: getEnv("R2_SECRET_ACCESS_KEY"),
        bucket: getEnv("R2_BUCKET_NAME"),
        publicUrl: getEnv("R2_PUBLIC_URL"),
      }
      break

    case "github":
      config.github = {
        owner: getEnv("GITHUB_OWNER"),
        repo: getEnv("GITHUB_REPO"),
        branch: getEnv("GITHUB_BRANCH") || "main",
        path: getEnv("GITHUB_PATH") || "",
        token: getEnv("GITHUB_TOKEN"),
      }
      break
  }

  return createStorage(config)
}

/**
 * 默认存储实例（从环境变量加载）
 */
export const storage = loadStorageFromEnv()

// 导出所有存储类型
export { R2Storage, LocalStorage, GitHubStorage }
export type { StorageProvider, FileMeta } from "./types"
export type { StorageConfig, StorageMode } from "./config"
