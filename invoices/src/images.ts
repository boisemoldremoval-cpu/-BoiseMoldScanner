// Shrinks a photo in the browser before upload so it stays small on the invoice and in the database.
export async function resizeImage(
  file: File,
  maxSize: number,
  type: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<{ dataUrl: string; width: number; height: number }> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`${file.name} is not an image`);
  }

  const url = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`${file.name} could not be read as an image`));
      img.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d')!;

    // JPEG has no transparency, so give it a white background instead of black.
    if (type === 'image/jpeg') {
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
    }

    context.drawImage(image, 0, 0, width, height);

    return { dataUrl: canvas.toDataURL(type, 0.82), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
