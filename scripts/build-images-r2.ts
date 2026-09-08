/**
 * R2 专用图片处理脚本
 * 
 * 功能：
 * - 从 R2 下载原图
 * - 生成缩略图并上传回 R2
 * - 本地只保存 photos.json 元数据
 * 
 * 用法: tsx scripts/build-images-r2.ts
 */

import 'dotenv/config';
import { readFile } from 'fs/promises';
import { processImagesR2, saveMetadataR2 } from '../src/lib/image/index-r2';
import { loadStorageFromEnv } from '../src/lib/storage/index';
import type { ImageMetadata } from '../src/lib/image/types';
import { join } from 'path';

async function main() {
  try {
    console.log('🚀 Lumen Gallery - R2 Image Processing\n');
    console.log('━'.repeat(50));
    console.log('📦 Mode: R2 Full Storage');
    console.log('   - Thumbnails: Upload to R2');
    console.log('   - Local files: Only photos.json');
    console.log('━'.repeat(50) + '\n');

    // 1. 加载存储配置
    console.log('📦 Loading R2 storage configuration...');
    const storage = loadStorageFromEnv();
    
    // 验证是否为 R2 存储
    if (!storage.uploadFile) {
      console.error('❌ Error: This script requires R2 storage with upload capability.');
      console.error('   Please set STORAGE_MODE=r2 in your .env file.');
      process.exit(1);
    }
    
    console.log('✓ R2 Storage loaded\n');

    // 2. 解析忽略目录配置（默认始终忽略 .thumbnails）
    const defaultIgnore = ['.thumbnails'];
    const envIgnore = process.env.R2_IGNORE_DIRS
      ? process.env.R2_IGNORE_DIRS.split(',').map(d => d.trim()).filter(Boolean)
      : [];
    const ignoreDirs = [...new Set([...defaultIgnore, ...envIgnore])];
    console.log(`🚫 Ignored directories: ${ignoreDirs.join(', ')}\n`);

    // 3. 加载已有的 photos.json（用于增量构建跳过已处理图片）
    const metadataPath = join(process.cwd(), 'public', 'photos.json');
    let existingMetadata: ImageMetadata[] = [];
    try {
      const raw = await readFile(metadataPath, 'utf-8');
      existingMetadata = JSON.parse(raw);
      console.log(`📂 Loaded existing metadata: ${existingMetadata.length} entries\n`);
    } catch {
      console.log('📂 No existing photos.json found, processing all images\n');
    }

    // 4. 处理图片（生成缩略图并上传到 R2）
    const metadata = await processImagesR2(storage, {
      thumbnailSize: 800,
      outputFormat: 'webp',
      quality: 85,
      ignoreDirs,
      existingMetadata,
    });

    // 5. 按拍摄时间降序排列（最新的在前）
    metadata.sort((a, b) => {
      const dateA = a.exif?.dateTime ? new Date(a.exif.dateTime).getTime() : 0;
      const dateB = b.exif?.dateTime ? new Date(b.exif.dateTime).getTime() : 0;
      return dateB - dateA;
    });

    // 6. 保存元数据到本地
    await saveMetadataR2(metadata, metadataPath);

    console.log('\n' + '━'.repeat(50));
    console.log('🎉 Done!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   - Images processed: ${metadata.length}`);
    console.log(`   - Thumbnails uploaded to R2: ${metadata.length}`);
    console.log(`   - Local file: public/photos.json`);
    console.log('');
    console.log('💡 Your R2 bucket structure:');
    console.log('   your-bucket/');
    console.log('   ├── photos/        (original images)');
    console.log('   └── .thumbnails/    (single thumbnail per image)');
    console.log('━'.repeat(50));
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
