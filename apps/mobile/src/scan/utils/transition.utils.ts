import { AlphaType, ColorType, Skia, type SkImage } from '@shopify/react-native-skia'
import type { Photo } from 'react-native-vision-camera'
import type { Quad } from '@/utils/geometry.utils'
import { quadToQuad } from '@/utils/homography.utils'

// Seconds from lock-on. docs/architecture/00-concepts/scan-pipeline.md describes the stages.

export const TRANSITION_END = 1.5
export const REDUCED_END = 0.3
/** The clock waits here until the photo is a Skia image. */
export const GATE_PHOTO = 0.05
/** The clock waits here until `recognise()` returns. */
export const GATE_RESULTS = 0.7
/** Seconds the results gate may hold before a spinner shows. */
export const SPINNER_DELAY = 1

export type Gates = { photo: boolean; results: boolean }

/** Every value is 0..1. digit is read with digitAlpha. */
export type Channels = {
  flash: number
  pulse: number
  flatten: number
  freeDrift: number
  dim: number
  ink: number
  cells: number
  lines: number
  photo: number
  shrink: number
  title: number
  rings: number
  panel: number
}

const DIGIT_SWEEP_START = 0.55
const DIGIT_STEP = 0.028
const DIGIT_FADE = 0.15

function ramp(t: number, from: number, to: number): number {
  'worklet'
  const x = Math.min(1, Math.max(0, (t - from) / (to - from)))
  return x * x * (3 - 2 * x)
}

/**
 * Seconds by which the digit sweep, the rings, the panel and the end move later, so that no digit pops in.
 * resultsAt: the clock value when the results gate opened, or below 0 while it is closed; then t stands in for it.
 */
export function sweepShift(resultsAt: number, t: number, reduceMotion: boolean): number {
  'worklet'
  if (reduceMotion) return 0
  return Math.max(0, (resultsAt < 0 ? t : resultsAt) - DIGIT_SWEEP_START)
}

/** shift: see sweepShift. Reduce Motion ignores it. */
export function transitionEnd(reduceMotion: boolean, shift = 0): number {
  'worklet'
  return reduceMotion ? REDUCED_END : TRANSITION_END + shift
}

export function ringsAt(t: number, reduceMotion: boolean, shift = 0): number {
  'worklet'
  return reduceMotion ? ramp(t, 0, REDUCED_END) : ramp(t - shift, 1.2, 1.4)
}

export function panelAt(t: number, reduceMotion: boolean, shift = 0): number {
  'worklet'
  return reduceMotion ? ramp(t, 0, REDUCED_END) : ramp(t - shift, 1.2, 1.5)
}

export function transitionAt(t: number, reduceMotion: boolean, shift = 0): Channels {
  'worklet'
  if (reduceMotion) {
    const f = ramp(t, 0, REDUCED_END)
    // The caller draws the photo in place, so flatten stays at 1 and nothing moves.
    return {
      flash: 0,
      pulse: 0,
      flatten: 1,
      freeDrift: f,
      dim: f,
      ink: f,
      cells: f,
      lines: f,
      photo: 1 - f,
      shrink: f,
      title: f,
      rings: f,
      panel: f,
    }
  }
  return {
    flash: 1 - ramp(t, 0, 0.25),
    pulse: Math.sin(Math.PI * ramp(t, 0, 0.25)),
    flatten: ramp(t, 0.05, 0.5),
    freeDrift: ramp(t, 0.05, 0.45),
    dim: ramp(t, 0.05, 0.5),
    ink: ramp(t, 0.15, 0.45),
    cells: ramp(t, 0.3, 0.55),
    lines: ramp(t, 0.35, 0.7),
    photo: 1 - ramp(t, 0.5, 0.8),
    shrink: ramp(t, 0.65, 0.95),
    title: ramp(t, 0.2, 0.5),
    rings: ringsAt(t, false, shift),
    panel: panelAt(t, false, shift),
  }
}

export function digitAlpha(t: number, row: number, col: number, reduceMotion: boolean, shift = 0): number {
  'worklet'
  if (reduceMotion) return ramp(t, 0, REDUCED_END)
  const start = DIGIT_SWEEP_START + shift + DIGIT_STEP * (row + col)
  return ramp(t, start, start + DIGIT_FADE)
}

/**
 * The next clock time: t + dt, held at a closed gate (GATE_PHOTO, then GATE_RESULTS; with Reduce Motion both gates are at 0).
 * A negative dt counts as 0. shift: see sweepShift.
 */
export function advanceClock(t: number, dt: number, gates: Gates, reduceMotion: boolean, shift = 0): number {
  'worklet'
  let limit = transitionEnd(reduceMotion, shift)
  const photoGate = reduceMotion ? 0 : GATE_PHOTO
  const resultsGate = reduceMotion ? 0 : GATE_RESULTS
  // A switch to the cross-fade moves the gates to 0. The photo gate then does not pull the clock back.
  if (!gates.photo && t <= photoGate) limit = Math.min(limit, photoGate)
  // Only the results end the transition, so a closed results gate holds the clock where it is, also past the gate.
  if (!gates.results) limit = Math.min(limit, Math.max(t, resultsGate))
  return Math.min(t + Math.max(0, dt), limit)
}

/**
 * Upright Skia image of the photo, long side at most maxSide px. Disposes every nitro image and the pixel data it makes. Runs on the JS thread.
 * The resize comes first: the pixels of the photo itself are the sideways sensor buffer, and resize returns them upright (ADR-002).
 */
export async function photoToSkImage(photo: Pick<Photo, 'toImageAsync'>, maxSide: number): Promise<SkImage> {
  const full = await photo.toImageAsync()
  try {
    const scale = Math.min(1, maxSide / Math.max(full.width, full.height))
    const small = await full.resizeAsync(Math.round(full.width * scale), Math.round(full.height * scale))
    try {
      const { buffer, width, height, pixelFormat } = await small.toRawPixelDataAsync()
      const colorType = colorTypeOf(pixelFormat)
      // The resize can pad each row, so the buffer gives the row length, not the width.
      const rowBytes = buffer.byteLength / height
      if (!Number.isInteger(rowBytes) || rowBytes < width * 4) {
        throw new Error(`the photo has ${buffer.byteLength} bytes for ${height} rows of ${width} pixels`)
      }
      const alphaType = pixelFormat.endsWith('X') ? AlphaType.Opaque : AlphaType.Premul
      const data = Skia.Data.fromBytes(new Uint8Array(buffer))
      let image: SkImage | null
      try {
        image = Skia.Image.MakeImage({ width, height, colorType, alphaType }, data, rowBytes)
      } finally {
        // The image keeps its own reference to the pixels.
        data.dispose()
      }
      if (image == null) throw new Error('Skia could not make an image of the photo')
      return image
    } finally {
      small.dispose()
    }
  } finally {
    full.dispose()
  }
}

function colorTypeOf(pixelFormat: string): ColorType {
  if (pixelFormat === 'BGRA' || pixelFormat === 'BGRX') return ColorType.BGRA_8888
  if (pixelFormat === 'RGBA' || pixelFormat === 'RGBX') return ColorType.RGBA_8888
  throw new Error(`the photo has the pixel format ${pixelFormat}`)
}

/**
 * One frame of the transition, in view points. quad: the grid of the dots and the photo. grid: the grid of the cells and the lines.
 * They are the same quad in the warp. In the cross-fade the dots stay on the locked grid, and the cells and lines are on the square.
 * crossFade: true when the Reduce Motion channels fade the layers, also without Reduce Motion (see TransitionPlan).
 */
export type CaptureFrame = { quad: Quad; grid: Quad; channels: Channels; crossFade: boolean }

/** Maps photo pixels (photoWidth × photoHeight, upright) to view points so that the normalised locked quad lands on screenQuad. */
export function photoMatrix(photoWidth: number, photoHeight: number, locked: Quad, screenQuad: Quad): number[] | null {
  'worklet'
  const inPixels = locked.map((p) => ({ x: p.x * photoWidth, y: p.y * photoHeight })) as Quad
  return quadToQuad(inPixels, screenQuad)
}
