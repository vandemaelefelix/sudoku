import type { PlayBlock } from '@/scan/utils/play.utils'

export const PANEL_HIDDEN = 1.4

/** Milliseconds a failure panel needs to slide up. */
export const FAILURE_SLIDE_MS = 300

/** The panel line for each play block. A given conflict has none: its chip and its marks say it. */
export const PLAY_BLOCK_TEXT: Readonly<Record<PlayBlock, string | null>> = {
  conflict: null,
  none: 'This puzzle has no solution. Check the marked cells.',
  several: 'A given is missing or wrong.',
  solved: 'This puzzle is already solved.',
}

/** The label of the Save button, by state. */
export const SAVE_TEXT = {
  idle: 'Save corrections',
  saving: 'Saving…',
  saved: 'Saved ✓',
  failed: 'Not saved. Try again',
} as const
