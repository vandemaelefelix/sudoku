import type { MessageId } from '@/i18n/messages'
import type { PlayBlock } from '@/scan/utils/play.utils'

/** Milliseconds the panel takes to grow or shrink to new content, such as the keypad. */
export const PANEL_RESIZE_MS = 220

/** The panel line for each play block. A given conflict and a full grid have none: their status line and their marks say it. */
export const PLAY_BLOCK_TEXT: Readonly<Record<PlayBlock, MessageId | null>> = {
  conflict: null,
  none: 'scan.block.none',
  several: 'scan.block.several',
  full: null,
}
