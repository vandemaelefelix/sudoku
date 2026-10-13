/** Milliseconds and points of the panel swap: the new content fades in and drifts up SWAP_RISE. A small rise keeps it calm. */
export const SWAP_MS = 300
export const SWAP_RISE = 4

/** Milliseconds the old content takes to fade out. The new content starts SWAP_DELAY_MS later, so the two crossfade. */
export const SWAP_OUT_MS = 200
export const SWAP_DELAY_MS = 40

/** Milliseconds by which the buttons follow the rest of the new content. The buttons only fade: they do not rise. */
export const SWAP_STAGGER_MS = 40
