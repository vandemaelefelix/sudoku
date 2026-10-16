import * as Haptics from 'expo-haptics'

/**
 * The haptics of the app. Each name has one meaning:
 * - tick: a mode or a value changed (a toggle, a segment, a note, an undo).
 * - tap: a number went in.
 * - thud: something is complete or locked (a unit, a grid lock-on, Play).
 * - soft: the app did a thing for the player (a hint, a pause).
 * - success, warning, error: a solve or a recognised scan, a mistake or a failed scan, a lost game.
 */
export type HapticName = 'tick' | 'tap' | 'thud' | 'soft' | 'success' | 'warning' | 'error'

const PLAY: Record<HapticName, () => Promise<void>> = {
  tick: () => Haptics.selectionAsync(),
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  thud: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  soft: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
}

/** Plays the haptic and returns at once. Use the useHaptics hook: it skips the haptic when the player turned haptics off. */
export function playHaptic(name: HapticName): void {
  // A phone without a haptic engine rejects the call. The app goes on without the haptic.
  PLAY[name]().catch(() => undefined)
}
