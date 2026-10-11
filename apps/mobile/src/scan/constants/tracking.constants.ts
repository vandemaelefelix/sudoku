/** The longest time in seconds between two frames inside one window. A longer gap means a pause. */
export const MAX_GAP = 0.5

/** Hz. The cutoff of a still corner. Lower is steadier. */
export const MIN_CUTOFF = 0.5

/** Hz per (normalised unit per second). Higher follows fast moves with less lag. */
export const BETA = 120

/** Hz. The cutoff of the speed estimate. */
export const DERIVATIVE_CUTOFF = 1

/** Seconds. The outline stays this long after the last detection. */
export const HOLD = 0.25

/** Seconds of outline without a gap per report (QR-06). */
export const JITTER_WINDOW = 5
