import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Photo } from '../types/photo';

// ========== 类型定义 ==========
interface PhotoViewerProps {
  photos: Photo[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

// ========== 工具函数 ==========
const formatBytes = (bytes: number, decimals = 1) => {
  if (!bytes) return '0B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(decimals)}${sizes[i]}`;
};

const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
};

// ========== 胶片条组件 ==========
/**
 * 虚拟化胶片条 — 使用 @tanstack/react-virtual 按需渲染，
 * 照片数量超过 100 张时仍保持流畅。
 */
const Filmstrip: React.FC<{
  photos: Photo[];
  currentIndex: number;
  onSelect: (index: number) => void;
}> = memo(({ photos, currentIndex, onSelect }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 虚拟化渲染器 — 仅渲染可见区域的缩略图
  const virtualizer = useVirtualizer({
    count: photos.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 76, // 64px 缩略图 + 12px gap
    horizontal: true,
    overscan: 5,
  });

  // 激活项变化时自动居中滚动
  useEffect(() => {
    if (currentIndex >= 0) {
      virtualizer.scrollToIndex(currentIndex, { align: 'center' });
    }
  }, [currentIndex, virtualizer]);

  return (
    <div className="filmstrip-wrapper">
      <div ref={scrollRef} className="filmstrip-scroll">
        <div
          className="filmstrip-inner"
          style={{ width: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const photo = photos[virtualItem.index];
            const isActive = virtualItem.index === currentIndex;
            const isAdjacent =
              Math.abs(virtualItem.index - currentIndex) === 1;

            return (
              <div
                key={photo.id}
                className={`filmstrip-item ${isActive ? 'active' : ''} ${isAdjacent ? 'adjacent' : ''}`}
                style={{
                  position: 'absolute',
                  left: `${virtualItem.start}px`,
                  top: 0,
                  width: `${virtualItem.size}px`,
                  height: '100%',
                }}
                onClick={() => onSelect(virtualItem.index)}
              >
                <img
                  src={photo.thumbnail.url}
                  alt={photo.filename}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

Filmstrip.displayName = 'Filmstrip';

// ========== 侧边栏信息组件 ==========
const PhotoInfoSidebar: React.FC<{ photo: Photo; onClose: () => void }> = memo(({ photo, onClose }) => {
  const exif = photo.exif;
  const shootTime = exif?.dateTime ? formatDate(exif.dateTime) : null;

  return (
    <div className="sidebar-panel">
      {/* 头部 */}
      <div className="sidebar-header">
        <h2 className="sidebar-title">照片信息</h2>
        <button
          onClick={onClose}
          className="sidebar-close-btn"
          title="关闭侧边栏"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* 内容区 */}
      <div className="sidebar-content">
        {/* 基本信息 */}
        <section className="sidebar-section">
          <h3 className="sidebar-section-title">基本信息</h3>
          <div className="sidebar-grid">
            <div className="sidebar-grid-span2">
              <span className="sidebar-label">文件名</span>
              <span className="sidebar-value break-all">{photo.filename}</span>
            </div>
            <div>
              <span className="sidebar-label">格式</span>
              <span className="sidebar-value">{photo.format?.toUpperCase() || '未知'}</span>
            </div>
            <div>
              <span className="sidebar-label">尺寸</span>
              <span className="sidebar-value">{photo.width} × {photo.height}</span>
            </div>
            <div>
              <span className="sidebar-label">文件大小</span>
              <span className="sidebar-value">{formatBytes(photo.size)}</span>
            </div>
            {shootTime && (
              <div className="sidebar-grid-span2">
                <span className="sidebar-label">拍摄时间</span>
                <span className="sidebar-value">{shootTime}</span>
              </div>
            )}
          </div>
        </section>

        {/* 拍摄参数 */}
        {exif && (exif.focalLength || exif.fNumber || exif.exposureTime || exif.iso) && (
          <section className="sidebar-section">
            <h3 className="sidebar-section-title">拍摄参数</h3>
            <div className="sidebar-grid">
              <div>
                <span className="sidebar-label">焦距</span>
                <span className="sidebar-value">{exif.focalLength ? `${exif.focalLength}mm` : '--'}</span>
              </div>
              <div>
                <span className="sidebar-label">光圈</span>
                <span className="sidebar-value">{exif.fNumber ? `f/${exif.fNumber}` : '--'}</span>
              </div>
              <div>
                <span className="sidebar-label">快门</span>
                <span className="sidebar-value">
                  {exif.exposureTime
                    ? (exif.exposureTime < 1 ? `1/${Math.round(1 / exif.exposureTime)}s` : `${exif.exposureTime}s`)
                    : '--'}
                </span>
              </div>
              <div>
                <span className="sidebar-label">ISO</span>
                <span className="sidebar-value">{exif.iso || '--'}</span>
              </div>
            </div>
          </section>
        )}

        {/* 设备信息 */}
        {exif && (exif.make || exif.model || exif.lensModel) && (
          <section className="sidebar-section">
            <h3 className="sidebar-section-title">设备信息</h3>
            {(exif.make || exif.model) && (
              <div className="mb-3">
                <span className="sidebar-label">相机</span>
                <span className="sidebar-value">{[exif.make, exif.model].filter(Boolean).join(' ')}</span>
              </div>
            )}
            {exif.lensModel && (
              <div>
                <span className="sidebar-label">镜头</span>
                <span className="sidebar-value">{exif.lensModel}</span>
              </div>
            )}
          </section>
        )}

        {/* 标签 */}
        {photo.tags && photo.tags.length > 0 && (
          <section className="sidebar-section">
            <h3 className="sidebar-section-title">标签</h3>
            <div className="flex flex-wrap gap-2">
              {photo.tags.map(tag => (
                <span key={tag} className="sidebar-tag">#{tag}</span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
});

PhotoInfoSidebar.displayName = 'PhotoInfoSidebar';

// ========== 主图片查看器组件 ==========
/**
 * 全屏图片查看器 Overlay
 * - 键盘导航：←/→ 切换，Esc 关闭，i 切换侧边栏
 * - 缩放：滚轮缩放、双击缩放（以点击位置为中心）、双指捏合
 * - 平移：放大后拖拽平移
 * - 原图降级：原图加载失败时回退到缩略图
 */
const PhotoViewer: React.FC<PhotoViewerProps> = ({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [showSidebar, setShowSidebar] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');

  // 缩放 & 平移状态
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // 拖拽状态
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragTranslate = useRef({ x: 0, y: 0 });

  // 双击检测（iOS Safari 不支持 dblclick 事件）
  const lastTapTime = useRef(0);

  // 双指捏合状态
  const initialPinchDistance = useRef(0);
  const initialPinchScale = useRef(1);

  const currentPhoto = photos[currentIndex];

  // 图片切换时重置状态
  useEffect(() => {
    setImageLoaded(false);
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    // 默认加载原图，失败时回退到缩略图
    if (currentPhoto) {
      setImageSrc(currentPhoto.original.url);
    }
  }, [currentIndex, currentPhoto]);

  // 原图加载失败 → 回退到缩略图
  const handleImageError = useCallback(() => {
    if (currentPhoto && imageSrc === currentPhoto.original.url) {
      setImageSrc(currentPhoto.thumbnail.url);
    }
  }, [currentPhoto, imageSrc]);

  // 缩放 <= 1 时自动归位
  useEffect(() => {
    if (scale <= 1) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    }
  }, [scale]);

  // 键盘导航
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (currentIndex > 0) onNavigate(currentIndex - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
          break;
        case 'i':
          setShowSidebar(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, photos.length, onClose, onNavigate]);

  // 锁定 body 滚动，补偿滚动条宽度避免页面抖动
  useEffect(() => {
    if (isOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [isOpen]);

  // ========== 滚轮缩放 ==========
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    // 鼠标相对于容器中心的偏移
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    const newScale = Math.max(0.5, Math.min(5, scale + delta));

    if (newScale !== scale) {
      // 以鼠标位置为缩放中心
      const scaleFactor = newScale / scale;
      const newTranslateX = mouseX - (mouseX - translate.x) * scaleFactor;
      const newTranslateY = mouseY - (mouseY - translate.y) * scaleFactor;
      setScale(newScale);
      setTranslate({ x: newTranslateX, y: newTranslateY });
    }
  }, [scale, translate]);

  // ========== 双击缩放（以点击位置为中心） ==========
  const handleDoubleClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0;
      clientY = e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY ?? 0;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const originX = clientX - rect.left - rect.width / 2;
    const originY = clientY - rect.top - rect.height / 2;

    if (scale > 1) {
      // 已放大 → 复位
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    } else {
      // 复位 → 放大到点击位置
      const newScale = 2.5;
      setScale(newScale);
      setTranslate({
        x: -(originX - translate.x) * (newScale / scale - 1) + translate.x,
        y: -(originY - translate.y) * (newScale / scale - 1) + translate.y,
      });
    }
  }, [scale, translate]);

  // ========== 触摸事件处理 ==========
  const getTouchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 双指捏合开始
      e.preventDefault();
      initialPinchDistance.current = getTouchDistance(e.touches);
      initialPinchScale.current = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      // 单指拖拽开始（仅在放大状态）
      isDragging.current = true;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      dragTranslate.current = { ...translate };
    } else if (e.touches.length === 1) {
      // 未放大状态的单指触摸 — 记录时间用于双击检测
      const now = Date.now();
      if (now - lastTapTime.current < 300) {
        e.preventDefault();
        handleDoubleClick(e);
      }
      lastTapTime.current = now;
    }
  }, [scale, translate, handleDoubleClick]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 双指捏合缩放
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches);
      const scaleChange = currentDistance / initialPinchDistance.current;
      const newScale = Math.max(0.5, Math.min(5, initialPinchScale.current * scaleChange));

      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left - rect.width / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top - rect.height / 2;
        const scaleFactor = newScale / scale;
        setTranslate({
          x: centerX - (centerX - translate.x) * scaleFactor,
          y: centerY - (centerY - translate.y) * scaleFactor,
        });
      }
      setScale(newScale);
    } else if (e.touches.length === 1 && isDragging.current) {
      // 单指拖拽平移
      e.preventDefault();
      setTranslate({
        x: dragTranslate.current.x + (e.touches[0].clientX - dragStart.current.x),
        y: dragTranslate.current.y + (e.touches[0].clientY - dragStart.current.y),
      });
    }
  }, [scale, translate]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    initialPinchDistance.current = 0;
  }, []);

  // ========== 鼠标拖拽 ==========
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      dragTranslate.current = { ...translate };
      e.preventDefault();
    }
  }, [scale, translate]);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      setTranslate({
        x: dragTranslate.current.x + (e.clientX - dragStart.current.x),
        y: dragTranslate.current.y + (e.clientY - dragStart.current.y),
      });
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isOpen]);

  // ========== 渲染 ==========
  if (!isOpen || !currentPhoto) return null;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  return (
    <div className="viewer-overlay">
      {/* 背景遮罩 */}
      <div className="viewer-backdrop" onClick={onClose} />

      {/* 主内容区 */}
      <div className="viewer-content">
        {/* 图片展示区 */}
        <div
          ref={containerRef}
          className="viewer-image-area"
          onClick={(e) => e.stopPropagation()}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: scale > 1 ? (isDragging.current ? 'grabbing' : 'grab') : 'default' }}
        >
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="viewer-btn viewer-close-btn"
            title="关闭 (Esc)"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          {/* 顶部工具栏 */}
          <div className="viewer-toolbar">
            <span className="viewer-counter">{currentIndex + 1} / {photos.length}</span>
            <button
              onClick={() => setShowSidebar(prev => !prev)}
              className={`viewer-btn ${showSidebar ? 'viewer-btn-active' : ''}`}
              title="切换信息面板 (i)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </button>
            <a
              href={currentPhoto.original.url}
              download={currentPhoto.filename}
              className="viewer-btn"
              title="下载原图"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </a>
          </div>

          {/* 上一张按钮 */}
          {hasPrev && (
            <button
              onClick={() => onNavigate(currentIndex - 1)}
              className="viewer-btn viewer-nav-btn viewer-nav-prev"
              title="上一张 (←)"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
          )}

          {/* 下一张按钮 */}
          {hasNext && (
            <button
              onClick={() => onNavigate(currentIndex + 1)}
              className="viewer-btn viewer-nav-btn viewer-nav-next"
              title="下一张 (→)"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          )}

          {/* 图片 */}
          <div className="viewer-image-wrapper">
            {!imageLoaded && (
              <div className="viewer-loading">
                <div className="viewer-spinner"></div>
              </div>
            )}
            <img
              ref={imgRef}
              src={imageSrc}
              alt={currentPhoto.filename}
              className={`viewer-image ${imageLoaded ? 'viewer-image-loaded' : ''}`}
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              }}
              onLoad={() => setImageLoaded(true)}
              onError={handleImageError}
              draggable={false}
            />
          </div>
        </div>

        {/* 侧边栏 */}
        <div className={`viewer-sidebar ${showSidebar ? 'viewer-sidebar-open' : ''}`}>
          {showSidebar && (
            <PhotoInfoSidebar
              photo={currentPhoto}
              onClose={() => setShowSidebar(false)}
            />
          )}
        </div>
      </div>

      {/* 底部胶片条 */}
      <Filmstrip
        photos={photos}
        currentIndex={currentIndex}
        onSelect={onNavigate}
      />

      {/* 内联样式（避免外部 CSS 依赖） */}
      <style>{`
        .viewer-overlay {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          flex-direction: column;
        }
        .viewer-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.92);
          backdrop-filter: blur(8px);
        }
        .viewer-content {
          position: relative;
          display: flex;
          flex: 1;
          min-height: 0;
        }
        .viewer-image-area {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          touch-action: none;
        }
        .viewer-image-wrapper {
          max-width: 100%;
          max-height: 100%;
          padding: 4rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .viewer-image {
          max-width: 100%;
          max-height: calc(100vh - 10rem);
          object-fit: contain;
          transition: opacity 0.3s, transform 0.1s ease-out;
          transform-origin: center center;
          user-select: none;
          -webkit-user-drag: none;
          will-change: transform;
        }
        .viewer-image-loaded {
          opacity: 1 !important;
        }
        .viewer-image:not(.viewer-image-loaded) {
          opacity: 0;
        }
        .viewer-loading {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .viewer-spinner {
          width: 2.5rem;
          height: 2.5rem;
          border: 4px solid rgba(255, 255, 255, 0.2);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* 通用按钮样式 */
        .viewer-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.5);
          color: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: background 0.2s;
          backdrop-filter: blur(4px);
          text-decoration: none;
        }
        .viewer-btn:hover {
          background: rgba(0, 0, 0, 0.7);
        }
        .viewer-btn-active {
          background: rgba(255, 255, 255, 0.2);
        }

        .viewer-close-btn {
          position: absolute;
          top: 1rem;
          left: 1rem;
          z-index: 10;
          padding: 0.5rem;
        }

        .viewer-toolbar {
          position: absolute;
          top: 1rem;
          right: 1rem;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .viewer-counter {
          padding: 0.375rem 0.75rem;
          background: rgba(0, 0, 0, 0.5);
          border-radius: 9999px;
          color: white;
          font-size: 0.875rem;
          backdrop-filter: blur(4px);
        }
        .viewer-toolbar .viewer-btn {
          padding: 0.5rem;
        }

        .viewer-nav-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 10;
          padding: 0.75rem;
        }
        .viewer-nav-prev { left: 1rem; }
        .viewer-nav-next { right: 1rem; }

        /* 侧边栏 */
        .viewer-sidebar {
          width: 0;
          overflow: hidden;
          transition: width 0.3s ease-in-out;
        }
        .viewer-sidebar-open {
          width: 360px;
        }
        .sidebar-panel {
          width: 360px;
          height: 100%;
          background: white;
          display: flex;
          flex-direction: column;
          box-shadow: -2px 0 20px rgba(0, 0, 0, 0.1);
        }
        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #f3f4f6;
        }
        .sidebar-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #1f2937;
          margin: 0;
        }
        .sidebar-close-btn {
          padding: 0.375rem;
          background: none;
          border: none;
          cursor: pointer;
          color: #6b7280;
          border-radius: 0.375rem;
          transition: background 0.15s;
        }
        .sidebar-close-btn:hover {
          background: #f3f4f6;
        }
        .sidebar-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem;
        }
        .sidebar-section {
          margin-bottom: 1.5rem;
        }
        .sidebar-section-title {
          font-size: 0.75rem;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0 0 0.75rem 0;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #f3f4f6;
        }
        .sidebar-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .sidebar-grid-span2 {
          grid-column: span 2;
        }
        .sidebar-label {
          font-size: 0.75rem;
          color: #9ca3af;
          display: block;
          margin-bottom: 0.25rem;
        }
        .sidebar-value {
          font-size: 0.875rem;
          color: #1f2937;
          font-weight: 500;
          word-break: break-word;
        }
        .sidebar-tag {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          background: #f3f4f6;
          border-radius: 9999px;
          font-size: 0.75rem;
          color: #4b5563;
        }

        /* 胶片条 */
        .filmstrip-wrapper {
          position: relative;
          flex-shrink: 0;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.7));
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          padding: 0.75rem 1rem;
        }
        .filmstrip-wrapper::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
        }
        .filmstrip-scroll {
          width: 100%;
          height: 80px;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
        }
        .filmstrip-scroll::-webkit-scrollbar {
          display: none;
        }
        .filmstrip-inner {
          position: relative;
          height: 100%;
        }
        .filmstrip-item {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .filmstrip-item img {
          width: 64px;
          height: 64px;
          object-fit: cover;
          border-radius: 6px;
          border: 2px solid rgba(255, 255, 255, 0.15);
          opacity: 0.5;
          filter: grayscale(30%);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .filmstrip-item.adjacent img {
          opacity: 0.75;
          filter: grayscale(0%);
          transform: scale(1.05);
          border-color: rgba(255, 255, 255, 0.3);
        }
        .filmstrip-item.active img {
          opacity: 1;
          filter: grayscale(0%);
          transform: scale(1.15);
          border-color: white;
          box-shadow: 0 0 16px rgba(255, 255, 255, 0.15), 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        .filmstrip-item:hover img {
          opacity: 0.85;
          filter: grayscale(0%);
          border-color: rgba(255, 255, 255, 0.4);
        }

        /* 移动端适配 */
        @media (max-width: 768px) {
          .viewer-sidebar-open {
            width: 100%;
            position: absolute;
            right: 0;
            top: 0;
            bottom: 80px;
            z-index: 20;
          }
          .sidebar-panel {
            width: 100%;
          }
          .viewer-image-wrapper {
            padding: 3rem 1rem;
          }
          .viewer-nav-btn {
            padding: 0.5rem;
          }
          .filmstrip-wrapper {
            padding: 0.5rem 0.5rem;
          }
          .filmstrip-scroll {
            height: 60px;
          }
          .filmstrip-item img {
            width: 48px;
            height: 48px;
          }
        }
      `}</style>
    </div>
  );
};

export default PhotoViewer;
