import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle, memo } from 'react';
import { Masonry } from 'masonic';
import { thumbHashToRGBA } from 'thumbhash';
import type { Photo } from '../types/photo';

// ========== 导出类型 ==========
export interface MasonryGalleryRef {
  reposition: () => void;
}

interface MasonicGalleryProps {
  photos: Photo[];
  columnWidth?: number;
  columnGutter?: number;
  /** 点击图片时的回调（左键单击触发 overlay，不跳页） */
  onPhotoClick?: (photo: Photo, index: number) => void;
}

// ========== ThumbHash 图片组件 ==========
/** 带 ThumbHash 占位符的懒加载图片组件 */
const ThumbHashImage: React.FC<{
  src: string;
  alt: string;
  width: number;
  height: number;
  thumbHash: string;
}> = ({ src, alt, width, height, thumbHash }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !thumbHash) return;

    try {
      // 将 Base64 ThumbHash 解码为 RGBA 像素数据
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
      {/* ThumbHash 占位符层 — 原图加载完成后淡出 */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300
          ${status === 'loaded' ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* 实际缩略图层 */}
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

      {/* 加载失败兜底 */}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 text-gray-500">
          <span>加载失败</span>
        </div>
      )}
    </div>
  );
};

// ========== 工具函数 ==========
const formatBytes = (bytes: number, decimals = 1) => {
  if (!bytes) return '0B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(decimals)}${sizes[i]}`;
};

// ========== 照片卡片组件 ==========
/**
 * 照片卡片 — 左键点击触发 onPhotoClick（打开 overlay），
 * 保留 <a> 标签用于右键/中键在新标签打开。
 */
const PhotoCard = memo(({ data: photo, index, onPhotoClick }: {
  data: Photo;
  index: number;
  onPhotoClick?: (photo: Photo, index: number) => void;
}) => {
  const handleClick = useCallback((e: React.MouseEvent) => {
    // 左键点击 → 触发 overlay，阻止默认跳转
    e.preventDefault();
    onPhotoClick?.(photo, index);
  }, [photo, index, onPhotoClick]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 中键点击 → 允许浏览器默认行为（新标签打开）
    if (e.button === 1) return;
  }, []);

  return (
    <div className="w-full">
      {/* 外层 div 处理左键点击，内部 <a> 保留右键菜单 */}
      <div
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        className="block relative bg-white overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group rounded-lg"
      >
        <ThumbHashImage
          src={photo.thumbnail.url}
          alt={photo.filename}
          width={photo.thumbnail.width}
          height={photo.thumbnail.height}
          thumbHash={photo.thumbHash}
        />

        {/* 悬浮信息层 */}
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

        {/* 隐藏的 <a> 标签 — 仅用于右键/中键"在新标签中打开" */}
        <a
          href={`/Gallery/${photo.key}`}
          className="absolute inset-0"
          onClick={(e) => e.preventDefault()}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    </div>
  );
});

PhotoCard.displayName = 'PhotoCard';

// ========== 主组件 ==========
/**
 * Masonic 瀑布流画廊组件
 * 使用 masonic 库实现高性能瀑布流布局，支持 SSR 骨架屏。
 */
const MasonicGallery = forwardRef<MasonryGalleryRef, MasonicGalleryProps>(
  ({ photos, columnWidth = 300, columnGutter = 10, onPhotoClick }, ref) => {
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

    // 将 onPhotoClick 注入到 PhotoCard 的 render 函数中
    // 必须在条件返回之前声明，保证 hooks 调用顺序一致
    const renderCard = useCallback((props: any) => {
      return <PhotoCard {...props} onPhotoClick={onPhotoClick} />;
    }, [onPhotoClick]);

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
          render={renderCard}
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
