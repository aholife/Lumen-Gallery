import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, memo, useCallback } from 'react';
import { Masonry } from 'masonic';
import { decode } from 'blurhash';
import PhotoViewer from './PhotoViewer';

// ========== 类型定义 ==========
interface Photo {
  id: string;
  key: string;
  filename: string;
  width: number;
  height: number;
  size: number;
  format?: string;
  blurhash: string;
  tags?: string[];
  Original?: { url: string };
  thumbnails: {
    small?: { url: string; width: number; height: number };
    medium: { url: string; width: number; height: number };
    large?: { url: string; width: number; height: number };
  };
  exif?: {
    Make?: string;
    Model?: string;
    LensModel?: string;
    FocalLength?: number;
    FNumber?: number;
    ExposureTime?: number;
    ISO?: number;
    DateTimeOriginal?: string;
  };
}

export interface MasonryGalleryRef {
  reposition: () => void;
}

interface MasonicGalleryProps {
  photos: Photo[];
  columnWidth?: number;
  columnGutter?: number;
  onPhotoClick?: (photo: Photo) => void;
}

// ========== BlurHash 图片组件 ==========
const BlurHashImage: React.FC<{
  src: string;
  alt: string;
  width: number;
  height: number;
  blurhash: string;
}> = ({ src, alt, width, height, blurhash }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !blurhash) return;

    try {
      const pixels = decode(blurhash, 32, 32);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.createImageData(32, 32);
        imageData.data.set(pixels);
        ctx.putImageData(imageData, 0, 0);
      }
    } catch (e) {
      console.error('BlurHash decode error:', e);
    }
  }, [blurhash]);

  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${width}/${height}` }}>
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 
          ${status === 'loaded' ? 'opacity-0' : 'opacity-100'}`}
        width={32}
        height={32}
      />

      {status !== 'error' && (
        <img
          src={src}
          alt={alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 
            ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          loading="lazy"
          decoding="async"
        />
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 text-gray-500">
          <span>加载失败</span>
        </div>
      )}
    </div>
  );
};

// ========== 照片卡片组件（使用 memo 优化） ==========
interface PhotoCardProps {
  data: Photo;
  index: number;
  onOpen: (index: number) => void;
}

const PhotoCard = memo(({ data: photo, index, onOpen }: PhotoCardProps) => {
  const formatBytes = (bytes: number, decimals = 1) => {
    if (!bytes) return '0B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(decimals)}${sizes[i]}`;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onOpen(index);
  };

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        className="block relative bg-white overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group rounded-lg"
      >
        <BlurHashImage
          src={photo.thumbnails.medium.url}
          alt={photo.filename}
          width={photo.thumbnails.medium.width}
          height={photo.thumbnails.medium.height}
          blurhash={photo.blurhash}
        />

        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex flex-wrap gap-2 mb-2">
            {(photo.tags?.length ? photo.tags : ['无标签']).map((tag) => (
              <span key={tag} className="px-2 py-0.5 bg-white/20 rounded text-xs backdrop-blur-sm">
                #{tag}
              </span>
            ))}
          </div>

          <div className="flex items-center text-xs text-white/90 gap-2 font-mono">
            <span>{photo.format?.toUpperCase() || 'UNK'}</span>
            <span className="opacity-60">·</span>
            <span>{photo.width}×{photo.height}</span>
            <span className="opacity-60">·</span>
            <span>{formatBytes(photo.size)}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

PhotoCard.displayName = 'PhotoCard';

// ========== 主组件 ==========
const MasonicGallery = forwardRef<MasonryGalleryRef, MasonicGalleryProps>(
  ({ photos, columnWidth = 300, columnGutter = 10 }, ref) => {
    const [positionIndex, setPositionIndex] = useState(0);
    const itemCounter = useRef(photos.length);

    // 图片查看器状态
    const [viewerOpen, setViewerOpen] = useState(false);
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

    // 暴露重新布局方法（学习自 Afilmory）
    useImperativeHandle(ref, () => ({
      reposition: () => setPositionIndex((i) => i + 1),
    }));

    // 检测列表是否收缩（修复 masonic bug，学习自 Afilmory）
    let shrunk = false;
    if (photos.length !== itemCounter.current) {
      shrunk = photos.length < itemCounter.current;
      itemCounter.current = photos.length;
    }

    // SSR 兼容：Astro 在服务端渲染时 window 不存在
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
      setIsMounted(true);
    }, []);

    // 打开图片查看器
    const handleOpenViewer = useCallback((index: number) => {
      setCurrentPhotoIndex(index);
      setViewerOpen(true);
    }, []);

    // 关闭图片查看器
    const handleCloseViewer = useCallback(() => {
      setViewerOpen(false);
    }, []);

    // 导航到指定图片
    const handleNavigate = useCallback((index: number) => {
      setCurrentPhotoIndex(index);
    }, []);

    // 自定义渲染函数，传递 index 和 onOpen
    const renderPhoto = useCallback(({ data, index }: { data: Photo; index: number }) => (
      <PhotoCard data={data} index={index} onOpen={handleOpenViewer} />
    ), [handleOpenViewer]);

    if (!isMounted) {
      // SSR 占位，避免水合不匹配
      return (
        <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.slice(0, 8).map((photo) => (
            <div
              key={photo.id}
              className="bg-gray-200 rounded-lg animate-pulse"
              style={{ aspectRatio: `${photo.width}/${photo.height}` }}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="w-full">
        <Masonry
          key={shrunk ? `shrunk-${Date.now()}` : `normal-${positionIndex}`}
          items={photos}
          render={renderPhoto}
          columnGutter={columnGutter}
          columnWidth={columnWidth}
          overscanBy={5}
        />

        {/* 自定义图片查看器 */}
        <PhotoViewer
          photos={photos}
          currentIndex={currentPhotoIndex}
          isOpen={viewerOpen}
          onClose={handleCloseViewer}
          onNavigate={handleNavigate}
        />
      </div>
    );
  }
);

MasonicGallery.displayName = 'MasonicGallery';

export default MasonicGallery;
