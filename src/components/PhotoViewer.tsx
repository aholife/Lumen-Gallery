import React, { useEffect, useState, useCallback, memo } from 'react';

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
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
};

// ========== 侧边栏信息组件 ==========
const PhotoInfoSidebar: React.FC<{ photo: Photo; onClose: () => void }> = memo(({ photo, onClose }) => {
  const exif = photo.exif;
  const shootTime = exif?.DateTimeOriginal ? formatDate(exif.DateTimeOriginal) : null;

  return (
    <div className="w-[360px] h-full bg-white flex flex-col shrink-0 shadow-[-2px_0_20px_rgba(0,0,0,0.1)]">
      {/* 头部 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800">照片信息</h2>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-500"
          title="关闭侧边栏"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* 基本信息 */}
        <section className="mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 pb-2 border-b border-gray-100">
            基本信息
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <span className="text-xs text-gray-400 block mb-1">文件名</span>
              <span className="text-sm text-gray-800 font-medium break-all">{photo.filename}</span>
            </div>
            <div>
              <span className="text-xs text-gray-400 block mb-1">格式</span>
              <span className="text-sm text-gray-800 font-medium">{photo.format?.toUpperCase() || '未知'}</span>
            </div>
            <div>
              <span className="text-xs text-gray-400 block mb-1">尺寸</span>
              <span className="text-sm text-gray-800 font-medium">{photo.width} × {photo.height}</span>
            </div>
            <div>
              <span className="text-xs text-gray-400 block mb-1">文件大小</span>
              <span className="text-sm text-gray-800 font-medium">{formatBytes(photo.size)}</span>
            </div>
            {shootTime && (
              <div className="col-span-2">
                <span className="text-xs text-gray-400 block mb-1">拍摄时间</span>
                <span className="text-sm text-gray-800 font-medium">{shootTime}</span>
              </div>
            )}
          </div>
        </section>

        {/* 拍摄参数 */}
        {exif && (exif.FocalLength || exif.FNumber || exif.ExposureTime || exif.ISO) && (
          <section className="mb-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 pb-2 border-b border-gray-100">
              拍摄参数
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-gray-400 block mb-1">焦距</span>
                <span className="text-sm text-gray-800 font-medium">
                  {exif.FocalLength ? `${exif.FocalLength}mm` : '--'}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-1">光圈</span>
                <span className="text-sm text-gray-800 font-medium">
                  {exif.FNumber ? `f/${exif.FNumber}` : '--'}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-1">快门</span>
                <span className="text-sm text-gray-800 font-medium">
                  {exif.ExposureTime
                    ? (exif.ExposureTime < 1
                      ? `1/${Math.round(1 / exif.ExposureTime)}s`
                      : `${exif.ExposureTime}s`)
                    : '--'}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-1">ISO</span>
                <span className="text-sm text-gray-800 font-medium">{exif.ISO || '--'}</span>
              </div>
            </div>
          </section>
        )}

        {/* 设备信息 */}
        {exif && (exif.Make || exif.Model || exif.LensModel) && (
          <section className="mb-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 pb-2 border-b border-gray-100">
              设备信息
            </h3>
            {(exif.Make || exif.Model) && (
              <div className="mb-3">
                <span className="text-xs text-gray-400 block mb-1">相机</span>
                <span className="text-sm text-gray-800 font-medium">
                  {[exif.Make, exif.Model].filter(Boolean).join(' ')}
                </span>
              </div>
            )}
            {exif.LensModel && (
              <div>
                <span className="text-xs text-gray-400 block mb-1">镜头</span>
                <span className="text-sm text-gray-800 font-medium">{exif.LensModel}</span>
              </div>
            )}
          </section>
        )}

        {/* 标签 */}
        {photo.tags && photo.tags.length > 0 && (
          <section className="mb-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 pb-2 border-b border-gray-100">
              标签
            </h3>
            <div className="flex flex-wrap gap-2">
              {photo.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                  #{tag}
                </span>
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
const PhotoViewer: React.FC<PhotoViewerProps> = ({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onNavigate
}) => {
  const [showSidebar, setShowSidebar] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);

  const currentPhoto = photos[currentIndex];

  // 获取原图或最大尺寸的缩略图
  const fullSizeUrl = currentPhoto?.Original?.url
    || currentPhoto?.thumbnails.large?.url
    || currentPhoto?.thumbnails.medium.url;

  // 键盘导航
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (currentIndex > 0) onNavigate(currentIndex - 1);
          break;
        case 'ArrowRight':
          if (currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
          break;
        case 'i':
          setShowSidebar(prev => !prev);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, photos.length, onClose, onNavigate]);

  // 锁定 body 滚动，同时补偿滚动条宽度避免页面抖动
  useEffect(() => {
    if (isOpen) {
      // 计算滚动条宽度
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

      // 隐藏滚动条并添加 padding 补偿
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

  // 图片切换时重置加载状态
  useEffect(() => {
    setImageLoaded(false);
  }, [currentIndex]);

  if (!isOpen || !currentPhoto) return null;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  return (
    <div className="fixed inset-0 z-[99999] flex" onClick={onClose}>
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
      />

      {/* 主内容区 */}
      <div className="relative flex w-full h-full">
        {/* 图片展示区 */}
        <div
          className={`flex-1 flex items-center justify-center relative transition-all duration-300 ${showSidebar ? 'mr-0' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors text-white"
            title="关闭 (Esc)"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          {/* 顶部工具栏 */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            {/* 图片计数 */}
            <span className="px-3 py-1.5 bg-black/50 rounded-full text-white text-sm">
              {currentIndex + 1} / {photos.length}
            </span>

            {/* 侧边栏切换按钮 */}
            <button
              onClick={() => setShowSidebar(prev => !prev)}
              className={`p-2 rounded-full transition-colors text-white ${showSidebar ? 'bg-white/20' : 'bg-black/50 hover:bg-black/70'}`}
              title="切换信息面板 (i)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </button>

            {/* 下载按钮 */}
            <a
              href={fullSizeUrl}
              download={currentPhoto.filename}
              className="p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors text-white"
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
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors text-white"
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
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors text-white"
              title="下一张 (→)"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          )}

          {/* 图片 */}
          <div className="max-w-full max-h-full p-16 flex items-center justify-center">
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              </div>
            )}
            <img
              src={fullSizeUrl}
              alt={currentPhoto.filename}
              className={`max-w-full max-h-[calc(100vh-8rem)] object-contain transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
              draggable={false}
            />
          </div>
        </div>

        {/* 侧边栏 */}
        <div
          className={`relative transition-all duration-300 ease-in-out ${showSidebar ? 'w-[360px]' : 'w-0'} overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          {showSidebar && (
            <PhotoInfoSidebar
              photo={currentPhoto}
              onClose={() => setShowSidebar(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoViewer;
export type { Photo };
