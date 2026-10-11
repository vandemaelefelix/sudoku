// Times are seconds. Speeds are points per second.
/** Corners slower than this count as slow. The lock-on threshold. Tuned on the device, see the scan-pipeline concept. */
export const STEADY_SPEED = 30

export const MOTION_TIME = 0.3

/** The scene is steady while motion is below this value. The lock-on threshold. Tuned on the device, see the scan-pipeline concept. */
export const STEADY_MOTION = 0.5

/** Seconds the grid must stay steady before the scan locks on. To tune on the device, see the scan-pipeline concept. */
export const LOCK_DWELL = 1.0

/** Seconds after the first frame of a scene with no lock-on, so the camera settles first. To tune on the device, see the scan-pipeline concept. */
export const WARMUP = 1.0

/** Seconds without a grid that arm a scene that is not armed. To tune on the device, see the scan-pipeline concept. */
export const REARM_LOST = 0.5

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
