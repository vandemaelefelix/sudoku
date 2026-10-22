import type { MessageId } from '@/i18n/messages'
import type { CellStyle } from '@/scan/utils/correction.utils'
import type { PlayBlock } from '@/scan/utils/play.utils'

/** The font size of a digit as a share of the cell side, for a role at the system scale. */
export const DIGIT_SHARE = 0.6

/** The panel starts this many panel heights below its place, so the transition slides it in from off screen. */
export const PANEL_HIDDEN = 1.4

/** Milliseconds the panel takes to grow or shrink to new content, such as the keypad. */
export const PANEL_RESIZE_MS = 220

/** Milliseconds a failure panel needs to slide up. */
export const FAILURE_SLIDE_MS = 300

/** The panel line for each play block. A given conflict and a full grid have none: their status line and their marks say it. */
export const PLAY_BLOCK_TEXT: Readonly<Record<PlayBlock, MessageId | null>> = {
  conflict: null,
  none: 'scan.block.none',
  several: 'scan.block.several',
  full: null,
}

/** The kind tag of the dev confidence overlay: Printed, Handwritten, Notes, or none for an empty cell. */
export const KIND_TAG: Readonly<Record<CellStyle, string>> = { given: 'P', entry: 'H', notes: 'N', empty: '' }

/** Milliseconds: the fade of the waiting spinner, in and out. */
export const WAITING_FADE_MS = 200
