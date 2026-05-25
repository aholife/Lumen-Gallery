import React, { useState, useEffect, useCallback, useRef } from 'react';
import MasonicGallery from './MasonicGallery';
import PhotoViewer from './PhotoViewer';
import type { Photo } from '../types/photo';

interface GalleryWithViewerProps {
  photos: Photo[];
  columnWidth?: number;
}

/**
 * 画廊 + 图片查看器的状态容器
 *
 * 职责：
 * - 管理 viewer 的打开/关闭状态（currentIndex: number | null）
 * - URL 同步：打开 viewer 时 pushState，关闭时 back()
 * - 监听 popstate 处理浏览器前进/后退
 * - 键盘焦点管理：记录触发元素，关闭时归还焦点
 */
const GalleryWithViewer: React.FC<GalleryWithViewerProps> = ({
  photos,
  columnWidth = 240,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // 记录触发 viewer 的 DOM 元素，关闭时归还焦点
  const triggerRef = useRef<HTMLElement | null>(null);

  // SSR 防御：避免 hydration 不一致
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ========== 从 URL 解析初始状态 ==========
  // 如果用户直接访问 /Gallery/xxx 并被重定向回来，可从 URL 恢复
  useEffect(() => {
    if (!isMounted) return;

    const path = window.location.pathname;
    if (path.startsWith('/Gallery/')) {
      const slug = path.replace('/Gallery/', '');
      const idx = photos.findIndex(p => p.key === slug);
      if (idx >= 0) {
        setCurrentIndex(idx);
      }
    }
  }, [isMounted, photos]);

  // ========== popstate 监听：处理浏览器前进/后退 ==========
  useEffect(() => {
    if (!isMounted) return;

    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/Gallery/')) {
        const slug = path.replace('/Gallery/', '');
        const idx = photos.findIndex(p => p.key === slug);
        setCurrentIndex(idx >= 0 ? idx : null);
      } else {
        // URL 回到首页 → 关闭 viewer
        setCurrentIndex(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isMounted, photos]);

  // ========== 打开 viewer ==========
  const openViewer = useCallback((photo: Photo, index: number) => {
    triggerRef.current = document.activeElement as HTMLElement;
    // 关键时序：先更新 React 状态，再写入 URL（避免 popstate 竞争）
    setCurrentIndex(index);
    history.pushState({}, '', `/Gallery/${photo.key}`);
  }, []);

  // ========== 关闭 viewer ==========
  const closeViewer = useCallback(() => {
    setCurrentIndex(null);
    history.back();
    // 归还焦点到触发元素
    setTimeout(() => {
      triggerRef.current?.focus();
      triggerRef.current = null;
    }, 100);
  }, []);

  // ========== 切换图片 ==========
  const navigateTo = useCallback((index: number) => {
    setCurrentIndex(index);
    // 替换当前历史记录（不产生新条目）
    history.replaceState({}, '', `/Gallery/${photos[index].key}`);
  }, [photos]);

  // SSR 骨架屏
  if (!isMounted) {
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
    <>
      <MasonicGallery
        photos={photos}
        columnWidth={columnWidth}
        onPhotoClick={openViewer}
      />

      <PhotoViewer
        photos={photos}
        currentIndex={currentIndex ?? 0}
        isOpen={currentIndex !== null}
        onClose={closeViewer}
        onNavigate={navigateTo}
      />
    </>
  );
};

export default GalleryWithViewer;
