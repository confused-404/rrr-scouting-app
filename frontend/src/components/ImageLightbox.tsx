import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ImageLightboxProps {
  imageUrl: string;
  imageAlt: string;
  imageName?: string;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  imageUrl,
  imageAlt,
  imageName,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-5xl rounded-2xl bg-white p-3 shadow-2xl sm:p-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/75 text-white transition-colors hover:bg-black"
          aria-label="Close image preview"
        >
          <X size={20} />
        </button>

        <img
          src={imageUrl}
          alt={imageAlt}
          className="max-h-[80vh] w-full rounded-xl bg-slate-100 object-contain"
        />

        {imageName && (
          <p className="px-2 pt-3 text-sm font-medium text-gray-600">
            {imageName}
          </p>
        )}
      </div>
    </div>
  );
};