import { Directory, File, Paths } from 'expo-file-system'
import { devWarn, errorMessage } from '@/utils/log.utils'
import { QUEUE_FOLDER } from '@/scanShare/constants/scanShare.constants'

export function fileUri(path: string): string {
  return path.startsWith('file:') ? path : `file://${path}`
}

export function readPhoto(path: string): Promise<Uint8Array> {
  return new File(fileUri(path)).bytes()
}

/** Saves the JPEG in the queue folder and returns its URI. */
export function writePhoto(scanId: string, jpeg: Uint8Array): string {
  const folder = new Directory(Paths.document, QUEUE_FOLDER)
  folder.create({ intermediates: true, idempotent: true })
  const file = new File(folder, `${scanId}.jpg`)
  file.create({ overwrite: true })
  file.write(jpeg)
  return file.uri
}

export function deletePhoto(path: string): void {
  try {
    new File(fileUri(path)).delete()
  } catch (error) {
    devWarn('scanShare', `the photo is not deleted: ${errorMessage(error)}`)
  }
}
