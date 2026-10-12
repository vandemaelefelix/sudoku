// Times are seconds. Speeds are points per second.
/** Corners slower than this count as slow. It drives the overlay motion. Lock-on reads the drift (ADR-019). */
export const STEADY_SPEED = 30

export const MOTION_TIME = 0.3

/** The scene is steady while motion is below this value. The overlay shows it. Lock-on reads the drift (ADR-019). */
export const STEADY_MOTION = 0.5

/** Seconds the same grid must stay in view without a clear move before the scan locks on (ADR-019). To tune on the device, see the scan-pipeline concept. */
export const LOCK_DWELL = 1.0

/** Seconds over which the drift measures the net corner move. Noise and tremor cancel over this time, a pan does not. To tune on the device, see the scan-pipeline concept. */
export const DRIFT_WINDOW = 0.3

/** Points per second. A drift above this value is a clear move, such as a pan, and starts the dwell again. To tune on the device, see the scan-pipeline concept. */
export const DRIFT_LIMIT = 150

/** Seconds. A drift needs at least this much track, so the first detections after a found event cannot count as a clear move. */
export const DRIFT_MIN_SPAN = 0.1

/** Seconds after the first frame of a scene with no lock-on, so the camera settles first. To tune on the device, see the scan-pipeline concept. */
export const WARMUP = 1.0

/** The smallest grid width, as a share of the view width, that can lock on. To tune on the device, see the scan-pipeline concept. */
export const MIN_GRID_WIDTH = 0.35

/** A big grid stays big down to MIN_GRID_WIDTH minus this share, so a grid near the limit does not flicker the progress. To tune on the device, see the scan-pipeline concept. */
export const GRID_WIDTH_HYSTERESIS = 0.03

/** A corner step in one frame larger than this share of the grid diagonal means another grid. */
export const JUMP = 0.25

/** The longest step the scene takes, so a pause does not make an effect jump. */
export const MAX_STEP = 0.1

/** Seconds for presence to go from 0 to 1, or back. */
export const PRESENCE_TIME = 0.4
