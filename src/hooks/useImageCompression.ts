// src/hooks/useImageCompression.ts
import { useState } from 'react';

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
}

export const useImageCompression = () => {
  const [isCompressing, setIsCompressing] = useState(false);

  const compressImage = async (
    file: File,
    options: CompressionOptions = {}
  ): Promise<File> => {
    const {
      maxWidth = 1200,
      maxHeight = 1200,
      quality = 0.85,
      maxSizeMB = 2,
    } = options;

    // Skip compression for small images or WebP
    if (file.size / (1024 * 1024) <= maxSizeMB && file.type === 'image/webp') {
      return file;
    }

    setIsCompressing(true);

    try {
      const image = await fileToImage(file);
      
      let { width, height } = image;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(image, 0, 0, width, height);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(
          (b) => resolve(b || new Blob()),
          'image/webp',
          quality
        );
      });

      const compressedFile = new File(
        [blob],
        file.name.replace(/\.[^/.]+$/, '') + '.webp',
        { type: 'image/webp' }
      );

      setIsCompressing(false);
      return compressedFile;
    } catch (error) {
      setIsCompressing(false);
      console.error('Compression failed:', error);
      return file;
    }
  };

  const fileToImage = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = e.target.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  return { compressImage, isCompressing };
};