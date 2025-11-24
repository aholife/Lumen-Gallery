/**
 * 构建时图片处理脚本
 * 用法: tsx scripts/build-images.ts
 */

import { processImages, saveMetadata } from '../src/lib/image/index';
import { loadStorageFromEnv } from '../src/lib/storage/index';
import { join } from 'path';

async function main() {
  try {
    console.log('🚀 Lumen Gallery - Image Processing\n');

    // 1. 加载存储配置
    console.log('📦 Loading storage configuration...');
    const storage = loadStorageFromEnv();
    console.log('✓ Storage loaded\n');

    // 2. 处理图片
    const outputDir = join(process.cwd(), 'public', 'processed');
    const metadata = await processImages(storage, outputDir, {
      thumbnailSizes: [300, 800, 1600],
      blurhashComponents: 4,
      outputFormat: 'jpg',
      quality: 85,
    });

    // 3. 保存元数据
    const metadataPath = join(process.cwd(), 'public', 'photos.json');
    await saveMetadata(metadata, metadataPath);

    console.log('\n🎉 Done! You can now run `pnpm dev` to see your gallery.');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
