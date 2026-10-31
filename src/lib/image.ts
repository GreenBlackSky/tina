/* Getting a phone photo ready to send: re-encoded as JPEG, at most 1600 px
   on its long side. That also converts iPhone HEIC photos wherever the
   browser can open them. */

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;

export interface PreparedImage {
  blob: Blob;
  /** a warning to show when the photo could not be converted */
  note: string;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('decode'));
    image.src = url;
  });
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  let url: string | undefined;
  try {
    url = URL.createObjectURL(file);
    const image = await loadImage(url);
    const scale = Math.min(
      1,
      MAX_SIDE / Math.max(image.naturalWidth || 1, image.naturalHeight || 1),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    return { blob: blob ?? file, note: '' };
  } catch {
    return {
      blob: file,
      note: `This photo couldn't be opened here (${file.type || 'unknown type'}). If it fails, try a JPEG or a screenshot.`,
    };
  } finally {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}
