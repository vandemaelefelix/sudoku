/** The turn of the phone, in radians, that tilts the card fully (ADR-017). */
export const TILT_RANGE = 0.35

/** The largest card rotation in degrees, as on the design canvas. */
export const MAX_ROTATE_X = 8
export const MAX_ROTATE_Y = 10

/** The perspective of the card rotation in points, as on the design canvas. */
export const PERSPECTIVE = 900

/** The part of the card width that the shine moves at a full tilt. */
export const SHINE_TRAVEL = 0.45

export const NO_TILT = { x: 0, y: 0 } as const
