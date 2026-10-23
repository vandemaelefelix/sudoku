import type { SkImage } from '@shopify/react-native-skia'
import type { Image } from 'react-native-nitro-image'
import type { Photo } from 'react-native-vision-camera'
import { createScanner, type RecogniseResult, type Scanner } from '@/scanner'
import { type CaptureResult, formatScanLog, toCaptureResult } from '@/scan/utils/captureResult.utils'
import { deletePickedImage, saveUprightPhoto, stillPhoto } from '@/scan/utils/photoFile'
import { photoToSkImage } from '@/scan/utils/photoImage.utils'
import { sameAspect, uprightAspect } from '@/scan/utils/preview.utils'
import { shareStore } from '@/scanShare/shareStore'
import type { Quad } from '@/utils/geometry.utils'
import { devWarn, errorMessage } from '@/utils/log.utils'
import type { Change } from './captureAttempt'
import { IMAGE_MAX_SIDE } from './useCaptureSession.constants'

/**
 * What a run needs from the session. current: true until a newer attempt starts or the screen unmounts. A stale run must not change
 * the state, so every change checks `current()` first. keepImage: the session owns the photo image, and disposes it.
 */
export type RunContext = {
  current(): boolean
  change(change: Change): void
  keepImage(image: SkImage): void
}

function startRun({ current, change, keepImage }: RunContext) {
  const began = Date.now()
  const guarded = (next: Change) => {
    if (current()) change(next)
  }

  const settle = (photoMs: number, result: CaptureResult) => {
    if (__DEV__) console.log(formatScanLog(photoMs, Date.now() - began, result))
    guarded({ type: 'result', result })
  }
  // noImage: no photo image will come, so the transition cross-fades.
  const fail = (error: unknown, photoMs: number, noImage = false) => {
    if (noImage) guarded({ type: 'imageFailed' })
    settle(photoMs, { ok: false, reason: errorMessage(error) })
  }
  const convert = async (photo: Pick<Photo, 'toImageAsync'>) => {
    try {
      const converted = await photoToSkImage(photo, IMAGE_MAX_SIDE)
      if (current()) {
        keepImage(converted)
        change({ type: 'image', image: converted })
      } else {
        converted.dispose()
      }
    } catch (error) {
      devWarn('scan', `photo conversion failed: ${errorMessage(error)}`)
      guarded({ type: 'imageFailed' })
    }
  }
  return { began, guarded, settle, fail, convert }
}

/**
 * The capture pipeline: photo, then the scan and the image conversion in parallel. quad: the locked grid, normalised to the frame.
 * frameAspect: the aspect of the frames at lock-on. takePhoto: the shutter. A failure settles as a failed result, and never throws.
 */
export async function runCapture(
  context: RunContext,
  takePhoto: () => Promise<Photo>,
  quad: Quad | null,
  frameAspect: number,
): Promise<void> {
  const { began, guarded, settle, fail, convert } = startRun(context)
  let photo: Photo
  let photoMs = 0
  let scanner: Scanner
  try {
    scanner = await createScanner()
    photo = await takePhoto()
    photoMs = Date.now() - began
  } catch (error) {
    fail(error, photoMs, true)
    return
  }
  // The quad is normalised to the frame. It fits the photo only when both have the same field of view (ADR-002). Without it,
  // recognise searches the whole photo and the transition cross-fades.
  let locked = quad
  if (quad != null && !sameAspect(uprightAspect(photo.width, photo.height, photo.orientation), frameAspect)) {
    locked = null
    devWarn('scan', 'the photo and the frame differ in aspect, so the locked quad does not fit the photo')
    guarded({ type: 'dropQuad' })
  }
  // Development builds keep the photo for the dev menu. Every build keeps it while sharing is on: the scan upload crops it (ADR-030).
  const saved =
    __DEV__ || shareStore.get()
      ? saveUprightPhoto(photo).catch((error) => {
          devWarn('scan', `the photo is not saved: ${errorMessage(error)}`)
          return null
        })
      : Promise.resolve(null)
  try {
    await Promise.all([
      scanner.recognise(photo, locked).then(
        async (result) => {
          const photoPath = await saved
          settle(photoMs, toCaptureResult(result, photoPath))
        },
        (error) => fail(error, photoMs),
      ),
      convert(photo),
    ])
  } finally {
    photo.dispose()
  }
}

/**
 * The import pipeline for an image from the photo library. uri: the cache copy of the picker. The run deletes it at the end.
 */
export async function runImport(context: RunContext, uri: string): Promise<void> {
  const { settle, fail } = startRun(context)
  const still = stillPhoto(uri)
  // One decoded copy of the image at a time: a library image can be far larger than a camera photo. The transition does not
  // draw an import, so the session makes no Skia image of it.
  try {
    let picked: Image
    let scanner: Scanner
    try {
      scanner = await createScanner()
      picked = await still.toImageAsync()
    } catch (error) {
      fail(error, 0, true)
      return
    }
    let result: RecogniseResult
    try {
      result = await scanner.recogniseStill(picked)
    } catch (error) {
      fail(error, 0)
      return
    } finally {
      picked.dispose()
    }
    // An imported image never uploads (ADR-030, amendment 2026-10-22). Only development builds keep it, for the dev menu.
    const photoPath =
      __DEV__ && result.ok
        ? await saveUprightPhoto(still).catch((error) => {
            devWarn('scan', `the image is not saved: ${errorMessage(error)}`)
            return null
          })
        : null
    const captured = toCaptureResult(result, photoPath)
    settle(0, captured.ok ? { ...captured, imported: true } : captured)
  } finally {
    deletePickedImage(uri)
  }
}
