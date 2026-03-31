import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle, memo } from 'react';
import { Masonry } from 'masonic';
import { thumbHashToRGBA } from 'thumbhash';

// ========== 类型定义 ==========
interface Photo {
  id: string;
  key: string;
  filename: string;
  width: number;
  height: number;
  size: number;
  format?: string;
  thumbHash: string;
  tags?: string[];
  thumbnail: { url: string; width: number; height: number };
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

// ========== ThumbHash 图片组件 ==========
const ThumbHashImage: React.FC<{
  src: string;
  alt: string;
  width: number;
  height: number;
  thumbHash: string;
  transitionName?: string;
}> = ({ src, alt, width, height, thumbHash, transitionName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !thumbHash) return;

    try {
      // 将 Base64 字符串解码为 Uint8Array
      const hash = Uint8Array.from(atob(thumbHash), c => c.charCodeAt(0));
      const { w, h, rgba } = thumbHashToRGBA(hash);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = w;
        canvas.height = h;
        const imageData = ctx.createImageData(w, h);
        imageData.data.set(rgba);
        ctx.putImageData(imageData, 0, 0);
      }
    } catch (e) {
      console.error('ThumbHash decode error:', e);
    }
  }, [thumbHash]);

  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${width}/${height}` }}>
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 
          ${status === 'loaded' ? 'opacity-0' : 'opacity-100'}`}
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
          style={transitionName ? { viewTransitionName: transitionName } as any : undefined}
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
const PhotoCard = memo(({ data: photo }: { data: Photo }) => {
  const formatBytes = (bytes: number, decimals = 1) => {
    if (!bytes) return '0B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(decimals)}${sizes[i]}`;
  };

  const transitionName = `photo-${photo.id}`;

  return (
    <div className="w-full">
      <a href={`/Gallery/${photo.key}`} className="block relative bg-white overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group rounded-lg">
        <ThumbHashImage
          src={photo.thumbnail.url}
          alt={photo.filename}
          width={photo.thumbnail.width}
          height={photo.thumbnail.height}
          thumbHash={photo.thumbHash}
          transitionName={transitionName}
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
      </a>
    </div>
  );
});

PhotoCard.displayName = 'PhotoCard';

// ========== 主组件 ==========
const MasonicGallery = forwardRef<MasonryGalleryRef, MasonicGalleryProps>(
  ({ photos, columnWidth = 300, columnGutter = 10 }, ref) => {
    const [positionIndex, setPositionIndex] = useState(0);
    const itemCounter = useRef(photos.length);

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
          render={PhotoCard}
          columnGutter={columnGutter}
          columnWidth={columnWidth}
          overscanBy={5}
        />
      </div>
    );
  }
);

MasonicGallery.displayName = 'MasonicGallery';

export default MasonicGallery;