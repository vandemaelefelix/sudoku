import { File } from 'expo-file-system'
import { loadImage } from 'react-native-nitro-image'
import type { Photo } from 'react-native-vision-camera'
import { devWarn, errorMessage } from '@/utils/log.utils'

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

/**
 * uri: the file that the photo picker copied to the cache folder. Each call loads the file again, so each caller disposes its own
 * image. The image keeps the EXIF orientation of the file. A resize draws it upright, as for a camera photo.
 */
export function stillPhoto(uri: string): Pick<Photo, 'toImageAsync'> {
  return { toImageAsync: async () => await loadImage({ filePath: uri }) }
}

/** Deletes the cache copy of a picked image. Never throws. */
export function deletePickedImage(uri: string): void {
  try {
    new File(uri).delete()
  } catch (error) {
    devWarn('scan', `the picked image is not deleted: ${errorMessage(error)}`)
  }
}
