// peakAt: the share of the duration at the largest scale. The end opacity is theme.opacity.disabled.
// reopenMs: the fade back to full opacity when an undo opens the number again.
export const KEY_DONE = { durationMs: 500, peakAt: 0.35, scale: 1.12, reopenMs: 200 } as const

/** The scale of the number label at the end of the swap to notes. The note label starts at the inverse. */
export const NOTE_SWAP_SCALE = 0.6
