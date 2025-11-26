import React, { useEffect, useRef, useState } from 'react';
import { Masonry } from 'masonic';
import { decode } from 'blurhash';

interface BlurHashImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  blurhash: string;
}

const BlurHashImage: React.FC<BlurHashImageProps> = ({ src, alt, width, height, blurhash }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && blurhash) {
      try {
        const pixels = decode(blurhash, 32, 32);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const imageData = ctx.createImageData(32, 32);
          imageData.data.set(pixels);
          ctx.putImageData(imageData, 0, 0);
        }
      } catch (e) {
        console.error('Error decoding blurhash', e);
      }
    }
  }, [blurhash]);

  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${width}/${height}` }}>
      <canvas
        ref={canvasRef}
        className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-0' : 'opacity-100'}`}
        width={32}
        height={32}
      />
      <img
        src={src}
        alt={alt}
        className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setIsLoaded(true)}
        loading="lazy"
      />
    </div>
  );
};

const PhotoCard = ({ data: photo }: { data: any }) => {
  const formatBytes = (bytes: number, decimals = 1) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))}${sizes[i]}`;
  };

  return (
    <div className="w-full">
      <div className="relative bg-white overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group rounded-lg">
        <div className="relative w-full overflow-hidden">
          <BlurHashImage
            src={photo.thumbnails.medium.url}
            alt={photo.filename}
            width={photo.thumbnails.medium.width}
            height={photo.thumbnails.medium.height}
            blurhash={photo.blurhash}
          />
        </div>
        
        <div className="absolute left-0 bottom-0 w-full p-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col gap-2 pointer-events-none">
          <div className="flex flex-wrap gap-2">
            {photo.tags && photo.tags.length > 0 ? (
              photo.tags.map((tag: string) => (
                <span key={tag} className="inline-block px-2 py-0.5 bg-white/20 text-white rounded text-xs backdrop-blur-sm">#{tag}</span>
              ))
            ) : (
              <span className="inline-block px-2 py-0.5 bg-white/20 text-white rounded text-xs backdrop-blur-sm">#无标签</span>
            )}
          </div>
          
          <div className="flex items-center text-xs text-white/90 gap-2 font-mono">
            <span>{photo.format ? photo.format.toUpperCase() : 'UNK'}</span>
            <span className="opacity-60">·</span>
            <span>{photo.width}x{photo.height}</span>
            <span className="opacity-60">·</span>
            <span>{formatBytes(photo.size)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function MasonicGallery({ photos }: { photos: any[] }) {
  return (
    <div className="w-full">
      <Masonry
        items={photos}
        render={PhotoCard}
        columnGutter={16}
        columnWidth={300}
        overscanBy={5}
      />
    </div>
  );
}
