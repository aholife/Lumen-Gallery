export interface FileMeta {
  key: string;
  lastModified: Date;
  size: number;
  etag?: string;
}

export interface StorageProvider {
  listFiles(prefix?: string): Promise<FileMeta[]>;
  downloadFile(key: string): Promise<Buffer>;
  uploadFile?(key: string, body: Buffer | Uint8Array | string, contentType?: string): Promise<void>;
  getPublicUrl?(key: string): string;
}
