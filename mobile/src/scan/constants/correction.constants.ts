/** The ring threshold. Provisional: the dev menu slider and the saved scans tune it. Aim: about 3 rings or fewer on a normal scan. */
export const REVIEW_CONFIDENCE = 0.8

/** The range of the ring threshold slider of the dev menu. */
export const THRESHOLD_RANGE = { min: 0.5, max: 0.99 } as const

/** Points above the bottom inset. The transition ends on a panel of this height. The panel grows when the keypad shows. */
export const PANEL_HEIGHT = 136

/** Points inside the panel, at the sides and at the top. */
export const PANEL_PADDING = 20
