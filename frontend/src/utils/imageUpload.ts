const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to process image.'));
    image.src = src;
  });

export const compressImageFile = async (
  file: File,
  options?: {
    maxDimension?: number;
    quality?: number;
    outputType?: string;
  }
): Promise<File> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  const {
    maxDimension = 1600,
    quality = 0.82,
    outputType = 'image/jpeg',
  } = options || {};

  const inputUrl = await fileToDataUrl(file);
  const image = await loadImage(inputUrl);

  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not initialize image compression.');
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error('Failed to compress image.'));
          return;
        }
        resolve(result);
      },
      outputType,
      quality
    );
  });

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
  const extension = outputType === 'image/png' ? 'png' : 'jpg';

  return new File([blob], `${baseName}.${extension}`, {
    type: blob.type,
    lastModified: Date.now(),
  });
};