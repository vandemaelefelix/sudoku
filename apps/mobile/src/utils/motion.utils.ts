import { ReduceMotion, withDelay, withTiming, type LayoutAnimation } from 'react-native-reanimated'

/**
 * The ease-out curve of every entrance: fast at the start, slow at the end. t and the result are 0..1.
 * A quint, close to CSS cubic-bezier(0.23, 1, 0.32, 1). A curve that eases in makes the screen feel late after a tap.
 */
export function easeOut(t: number): number {
  'worklet'
  return 1 - (1 - t) ** 5
}

/** The curve of an exit: slow at the start, fast at the end, so the element accelerates away. t and the result are 0..1. */
export function easeIn(t: number): number {
  'worklet'
  return t ** 3
}

/** The curve of a move across the screen: slow at the start and at the end. t and the result are 0..1. */
export function easeInOut(t: number): number {
  'worklet'
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
}

/**
 * An entering animation: the element fades in and rises riseBy points, after delayMs, over durationMs with easeOut.
 * It plays with Reduce Motion on too: give riseBy 0 then, so the element only fades.
 */
export function riseIn(delayMs: number, riseBy: number, durationMs: number): () => LayoutAnimation {
  return () => {
    'worklet'
    const timing = { duration: durationMs, easing: easeOut, reduceMotion: ReduceMotion.Never }
    return {
      initialValues: { opacity: 0, transform: [{ translateY: riseBy }] },
      animations: {
        opacity: withDelay(delayMs, withTiming(1, timing)),
        transform: [{ translateY: withDelay(delayMs, withTiming(0, timing)) }],
      },
    }
  }
}
