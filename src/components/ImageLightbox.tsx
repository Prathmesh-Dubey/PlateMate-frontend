// src/components/ImageLightbox.tsx - full-screen zoomed preview for a single image
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  title?: string;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, alt, title, onClose }) => {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title || alt || 'Image preview'}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label="Close preview"
      >
        <X className="w-5 h-5" />
      </button>

      {title && (
        <div className="absolute top-4 left-4 right-16 text-white text-sm font-semibold truncate">
          {title}
        </div>
      )}

      <img
        src={src}
        alt={alt || 'Preview'}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full rounded-lg shadow-2xl object-contain"
      />
    </div>
  );
};

export default ImageLightbox;
