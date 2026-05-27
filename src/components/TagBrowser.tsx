import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import MasonicGallery from './MasonicGallery';
import PhotoViewer from './PhotoViewer';
import type { Photo } from '../types/photo';

interface TagBrowserProps {
  tags: string[];
  photos: Photo[];
  columnWidth?: number;
}

const TagBrowser: React.FC<TagBrowserProps> = ({
  tags,
  photos,
  columnWidth = 240,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ========== 搜索匹配逻辑 ==========
  const matchSearch = useCallback((photo: Photo, query: string): boolean => {
    const q = query.toLowerCase();
    // 标签名
    if (photo.tags?.some(tag => tag.toLowerCase().includes(q))) return true;
    // 文件名
    if (photo.filename.toLowerCase().includes(q)) return true;
    // EXIF: 相机制造商
    if (photo.exif?.make?.toLowerCase().includes(q)) return true;
    // EXIF: 相机型号
    if (photo.exif?.model?.toLowerCase().includes(q)) return true;
    // EXIF: 镜头型号
    if (photo.exif?.lensModel?.toLowerCase().includes(q)) return true;
    return false;
  }, []);

  // ========== 筛选逻辑 ==========
  const filteredPhotos = useMemo(() => {
    return photos.filter(photo => {
      // 标签筛选：无选中 → 全部通过；有选中 → 照片标签与选中标签有交集
      const tagMatch = selectedTags.length === 0 ||
        selectedTags.some(tag => photo.tags?.includes(tag));

      // 搜索筛选：无输入 → 全部通过；有输入 → 匹配
      const searchMatch = !searchQuery ||
        matchSearch(photo, searchQuery);

      // 两个条件取交集（AND）
      return tagMatch && searchMatch;
    });
  }, [photos, selectedTags, searchQuery, matchSearch]);

  // ========== 标签切换 ==========
  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  }, []);

  // ========== 清除所有选中 ==========
  const clearTags = useCallback(() => {
    setSelectedTags([]);
    setSearchQuery('');
  }, []);

  // ========== Viewer 操作 ==========
  const openViewer = useCallback((photo: Photo, index: number) => {
    triggerRef.current = document.activeElement as HTMLElement;
    setCurrentIndex(index);
  }, []);

  const closeViewer = useCallback(() => {
    setCurrentIndex(null);
    setTimeout(() => {
      triggerRef.current?.focus();
      triggerRef.current = null;
    }, 100);
  }, []);

  const navigateTo = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  // ========== SSR 骨架屏 ==========
  if (!isMounted) {
    return (
      <div className="w-full">
        <div className="h-10 bg-gray-200 rounded-lg animate-pulse mb-4" />
        <div className="flex flex-wrap gap-2 mb-6">
          {tags.slice(0, 8).map(tag => (
            <div key={tag} className="h-8 w-16 bg-gray-200 rounded-full animate-pulse" />
          ))}
        </div>
        <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.slice(0, 8).map(photo => (
            <div
              key={photo.id}
              className="bg-gray-200 rounded-lg animate-pulse"
              style={{ aspectRatio: `${photo.width}/${photo.height}` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* 搜索栏 */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索标签、文件名、相机、镜头..."
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            placeholder-gray-400"
        />
      </div>

      {/* 标签按钮区 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tags.map(tag => {
          const isSelected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200
                ${isSelected
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              #{tag}
            </button>
          );
        })}
        {(selectedTags.length > 0 || searchQuery) && (
          <button
            onClick={clearTags}
            className="px-3 py-1.5 rounded-full text-sm font-medium
              bg-red-50 text-red-600 hover:bg-red-100 transition-all duration-200"
          >
            清除筛选
          </button>
        )}
      </div>

      {/* 结果计数 */}
      {(selectedTags.length > 0 || searchQuery) && (
        <div className="text-sm text-gray-500 mb-4">
          找到 {filteredPhotos.length} 张照片
        </div>
      )}

      {/* 瀑布流画廊 */}
      <MasonicGallery
        photos={filteredPhotos}
        columnWidth={columnWidth}
        onPhotoClick={openViewer}
      />

      {/* 图片查看器 */}
      <PhotoViewer
        photos={filteredPhotos}
        currentIndex={currentIndex ?? 0}
        isOpen={currentIndex !== null}
        onClose={closeViewer}
        onNavigate={navigateTo}
      />
    </div>
  );
};

export default TagBrowser;
