import type { SkImage } from '@shopify/react-native-skia'
import type { CaptureResult, ScanOrigin } from '@/scan/utils/captureResult.utils'
import type { Gates } from '@/scan/utils/transition.utils'
import type { Quad } from '@/utils/geometry.utils'

/** live: the camera. capturing: lock-on to the end of the transition. review: the static correction screen. */
export type CapturePhase = 'live' | 'capturing' | 'review'

/**
 * lockedView: quad in view points, or null. image: null until it is ready. imageFailed: no image will come, because the photo or its
 * conversion failed.
 */
export type Attempt = {
  phase: CapturePhase
  origin: ScanOrigin
  quad: Quad | null
  lockedView: Quad | null
  image: SkImage | null
  imageFailed: boolean
  result: CaptureResult | null
}

export type Change =
  | { type: 'start'; quad: Quad | null; lockedView: Quad | null; origin: ScanOrigin }
  | { type: 'image'; image: SkImage }
  | { type: 'imageFailed' }
  | { type: 'dropQuad' }
  | { type: 'result'; result: CaptureResult }
  | { type: 'end' }

export const LIVE: Attempt = {
  phase: 'live',
  origin: 'camera',
  quad: null,
  lockedView: null,
  image: null,
  imageFailed: false,
  result: null,
}

/** A start begins a new attempt. Any other change before it is a late callback of a dead attempt, and the live state ignores it. */
export function reduceAttempt(attempt: Attempt, change: Change): Attempt {
  if (change.type === 'start') {
    return { ...LIVE, phase: 'capturing', origin: change.origin, quad: change.quad, lockedView: change.lockedView }
  }
  if (attempt.phase === 'live') return attempt
  switch (change.type) {
    case 'image':
      return { ...attempt, image: change.image }
    case 'imageFailed':
      return { ...attempt, imageFailed: true }
    case 'dropQuad':
      // lockedView stays: the dots of the cross-fade stay on the grid that the player locked.
      return { ...attempt, quad: null }
    case 'result':
      return { ...attempt, result: change.result }
    case 'end':
      return attempt.phase === 'capturing' ? { ...attempt, phase: 'review' } : attempt
  }
}

// Without a locked grid or a photo, nothing can flatten (scan-pipeline concept).
export function crossFadeOf(attempt: Attempt, reduceMotion: boolean): boolean {
  return (
    attempt.phase !== 'live' &&
    (reduceMotion || attempt.quad == null || attempt.lockedView == null || attempt.imageFailed)
  )
}

/** The photo gate opens when the image is ready or will never come. Only an ok result opens the results gate. */
export function gatesOf(attempt: Attempt): Gates {
  const live = attempt.phase === 'live'
  return {
    photo: !live && (attempt.image != null || attempt.quad == null || attempt.imageFailed),
    results: attempt.result?.ok === true,
  }
}
