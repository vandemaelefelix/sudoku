/** The 4 wavy lines of the Op-art panel edge, from the design canvas: each line lower, with a larger amplitude. Points. */
export const WAVES = [0, 1, 2, 3].map((k) => ({ y: 8 + k * 6, amp: 1.5 + k * 1.3 }))
export const WAVE_PERIOD = 44
export const WAVE_WIDTH = 2.2

/** Points: the height of the card edge. It holds the 4 lines with their amplitude. */
export const CARD_EDGE_HEIGHT = 34
