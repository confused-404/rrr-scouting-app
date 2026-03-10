import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, storage } from '../config/firebase';

const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1600;
const JPEG_QUALITY = 0.78;

export type UploadedImage = {
  url: string;
  name: string;
  size: number;
  type: string;
};

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode image.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
};

const loadImageSource = async (file: File): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read image file.'));
      img.src = url;
    });

    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const compressImage = async (file: File): Promise<Blob> => {
  const source = await loadImageSource(file);
  const sourceWidth = source instanceof ImageBitmap ? source.width : source.naturalWidth || source.width;
  const sourceHeight = source instanceof ImageBitmap ? source.height : source.naturalHeight || source.height;
  const scale = Math.min(MAX_WIDTH / sourceWidth, MAX_HEIGHT / sourceHeight, 1);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    if (source instanceof ImageBitmap) {
      source.close();
    }
    throw new Error('Unable to process image on this device.');
  }

  ctx.drawImage(source, 0, 0, width, height);
  if (source instanceof ImageBitmap) {
    source.close();
  }

  return canvasToBlob(canvas, JPEG_QUALITY);
};

export const uploadScoutingImage = async (
  file: File,
  meta: { competitionId?: string; formId?: string; fieldId: number }
): Promise<UploadedImage> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select an image file.');
  }

  const compressed = await compressImage(file);
  const uid = auth.currentUser?.uid || 'anonymous';
  const stamp = Date.now();
  const competitionSegment = meta.competitionId || 'unknown-comp';
  const formSegment = meta.formId || 'unknown-form';
  const path = `submissions/${competitionSegment}/${formSegment}/field-${meta.fieldId}/${uid}-${stamp}.jpg`;

  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(storageRef);

  return {
    url,
    name: file.name,
    size: compressed.size,
    type: 'image/jpeg',
  };
};
