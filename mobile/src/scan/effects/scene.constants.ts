// Times are seconds. Speeds are points per second.
/** Corners slower than this count as slow. It drives the overlay motion. Lock-on does not read it (ADR-019). */
export const STEADY_SPEED = 30

export const MOTION_TIME = 0.3

/** The scene is steady while motion is below this value. The overlay shows it. Lock-on does not read it (ADR-019). */
export const STEADY_MOTION = 0.5

/** A corner step in one frame larger than this share of the grid diagonal means another grid. */
export const JUMP = 0.25

/** The longest step the scene takes, so a pause does not make an effect jump. */
export const MAX_STEP = 0.1

/** Seconds for presence to go from 0 to 1, or back. */
export const PRESENCE_TIME = 0.4
