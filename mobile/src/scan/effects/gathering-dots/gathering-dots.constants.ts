import { DOT_SPACING } from '@/scan/effects/common/common.constants'

// Stage 1 of the scan experience design. Opacities are 0..1, times are seconds, sizes are points.
export const DIM = 0.3

export const FREE_ALPHA = 0.32

export const GATHER_ALPHA_START = 0.4

export const GATHER_ALPHA_END = 0.8

export const FLIGHT = 0.7

export const MAX_DELAY = 0.35

export const GROW = 1.25

export const GROW_BOX = 1.7

/** The share of its wobble that a gathered dot keeps while the corners move. */
export const WOBBLE = 0.15

/** The share by which lock-on brightens a gathered dot: GATHER_ALPHA_END 0.8 goes to 1. */
export const LOCK_BRIGHTEN = 0.25

/** Grid coordinates. */
export const MARGIN = 0.08

export const SPREAD_TIME = 1.0

export const RELEASE_TIME = 0.5

export const REDUCED_FADE = 0.2

export const SPREAD_RADIUS = 1.3 * DOT_SPACING

export const SPREAD_PUSH = 0.05 * DOT_SPACING

/** Grid diagonals from the grid centre within which free dots spread. */
export const NEAR = 1.5

/** The capture transition (scan-pipeline concept). The radius of a gathered dot at the top of the pulse is 1 + PULSE_GROW times its radius. */
export const PULSE_GROW = 0.6

/** The radius of an ink dot as a share of the white dot: the ink dots fit the crossings of the lines. */
export const INK_RADIUS = 0.8

/** Points that a free dot moves away from the grid centre at freeDrift 1. */
export const FREE_DRIFT = 40
/** The width of a drawn star as a multiple of the dot radius. */
export const STAR_SCALE = 9
