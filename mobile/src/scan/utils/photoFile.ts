import type { Photo } from 'react-native-vision-camera'

/**
 * Saves the photo upright as a JPEG in the temporary folder and returns its path. The pixels of the photo are the sideways sensor buffer,
 * and a resize draws them upright (ADR-002), so the file needs no orientation tag and the normalised corners fit it.
 */
export async function saveUprightPhoto(photo: Pick<Photo, 'toImageAsync'>): Promise<string> {
  const full = await photo.toImageAsync()
  try {
    const upright = await full.resizeAsync(full.width, full.height)
    try {
      return await upright.saveToTemporaryFileAsync('jpg', 92)
    } finally {
      upright.dispose()
    }
  } finally {
    full.dispose()
  }
}
