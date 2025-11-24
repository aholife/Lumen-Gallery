/**
 * 存储配置类型定义
 */

export type StorageMode = "local" | "r2" | "s3" | "github"

export interface StorageConfig {
  mode: StorageMode
  local?: LocalStorageConfig
  r2?: R2StorageConfig
  s3?: S3StorageConfig
  github?: GitHubStorageConfig
}

export interface LocalStorageConfig {
  basePath: string
  publicPath?: string
}

export interface R2StorageConfig {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicUrl?: string
}

export interface S3StorageConfig {
  region: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicUrl?: string
}

export interface GitHubStorageConfig {
  owner: string
  repo: string
  branch?: string
  path?: string
  token?: string
}
