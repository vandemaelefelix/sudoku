/** The turn of the phone, in radians, that tilts the card fully (ADR-017). */
export const TILT_RANGE = 0.35

/** The largest card rotation in degrees, as on the design canvas. */
export const MAX_ROTATE_X = 8
export const MAX_ROTATE_Y = 10

/** The perspective of the card rotation in points, as on the design canvas. */
export const PERSPECTIVE = 900

/** The part of the card width that the shine moves at a full tilt. */
export const SHINE_TRAVEL = 0.45

/** The glare spot moves this many times the shine travel. It is the light itself, so it moves faster than the streak. */
export const SPOT_PARALLAX = 1.6

/** The glare opacity of a card at rest. A full tilt gives 1. */
export const GLARE_REST = 0.4

export const NO_TILT = { x: 0, y: 0 } as const
