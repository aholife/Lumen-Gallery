import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { StorageProvider, FileMeta } from "./types";

export class R2Storage implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private publicUrl?: string;

  constructor(config: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicUrl?: string;
  }) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Cloudflare R2 不支持 AWS SDK v3 新的校验头
      // 参考: https://github.com/aws/aws-sdk-js-v3/issues/6810
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    this.bucket = config.bucket;
    this.publicUrl = config.publicUrl;
  }

  async listFiles(prefix?: string): Promise<FileMeta[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
    });

    const response = await this.client.send(command);
    return (response.Contents || []).map((item) => ({
      key: item.Key || "",
      lastModified: item.LastModified || new Date(),
      size: item.Size || 0,
      etag: item.ETag,
    }));
  }

  async downloadFile(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    if (!response.Body) {
      throw new Error(`File not found: ${key}`);
    }
    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
  }

  async uploadFile(key: string, body: Buffer | Uint8Array | string, contentType?: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await this.client.send(command);
  }

  getPublicUrl(key: string): string {
    if (this.publicUrl) {
      // Remove trailing slash from publicUrl if present, and leading slash from key if present
      const baseUrl = this.publicUrl.replace(/\/$/, "");
      const cleanKey = key.replace(/^\//, "");
      return `${baseUrl}/${cleanKey}`;
    }
    return key;
  }
}
