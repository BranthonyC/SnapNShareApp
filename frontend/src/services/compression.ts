import imageCompression from 'browser-image-compression';

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
  // Preserve EXIF data for date/location metadata
  exifOrientation: -1,
} satisfies Parameters<typeof imageCompression>[1];

/**
 * Compresses an image File to at most 1 MB / 1920 px on the longest edge.
 * Output is always JPEG.  On any failure the original file is returned
 * so the upload pipeline is never blocked.
 */
export async function compressImage(file: File): Promise<File> {
  // Skip non-image files (e.g. video — handled separately)
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // Skip tiny files that are already well under the target size
  if (file.size <= 200 * 1024) {
    return file;
  }

  try {
    const compressed = await imageCompression(file, COMPRESSION_OPTIONS);

    // Preserve the original file name, only swap extension for JPEG
    const originalName = file.name.replace(/\.[^.]+$/, '');
    const compressedFile = new File([compressed], `${originalName}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });

    return compressedFile;
  } catch (err) {
    console.warn('[compression] Failed to compress image, using original:', err);
    return file;
  }
}
