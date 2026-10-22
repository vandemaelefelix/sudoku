import { launchImageLibraryAsync, UIImagePickerPreferredAssetRepresentationMode } from 'expo-image-picker'
import { useCallback, useRef, useState } from 'react'
import { devWarn, errorMessage } from '@/utils/log.utils'

/** picked: uri is the cache copy of the image. cancelled: the player closed the picker. failed: the image did not load. */
export type ImagePick = { kind: 'picked'; uri: string } | { kind: 'cancelled' } | { kind: 'failed'; reason: string }

/**
 * The photo picker of iOS. It runs outside the app, so the app gets only the image that the player picks and asks for no photo
 * library permission. picking: the picker is open, so the camera can stop and the lock-on cannot fire behind it. A second call
 * while the picker is open gives cancelled.
 */
export function useImageImport(): { picking: boolean; choose: () => Promise<ImagePick> } {
  const [picking, setPicking] = useState(false)
  const open = useRef(false)

  const choose = useCallback(async (): Promise<ImagePick> => {
    if (open.current) return { kind: 'cancelled' }
    open.current = true
    setPicking(true)
    try {
      // quality 1, no edit and the current representation: the picker copies the original file and does not encode it again.
      const picked = await launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 1,
        exif: false,
        base64: false,
        preferredAssetRepresentationMode: UIImagePickerPreferredAssetRepresentationMode.Current,
      })
      const asset = picked.canceled ? undefined : picked.assets[0]
      return asset === undefined ? { kind: 'cancelled' } : { kind: 'picked', uri: asset.uri }
    } catch (error) {
      devWarn('scan', `the photo picker failed: ${errorMessage(error)}`)
      return { kind: 'failed', reason: errorMessage(error) }
    } finally {
      open.current = false
      setPicking(false)
    }
  }, [])

  return { picking, choose }
}
