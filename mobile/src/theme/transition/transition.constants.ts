import { EXIT_END_MS } from '@/splash/constants/splash.constants'

// The timing of the theme switch effect (ADR-025). Times are in milliseconds.

/** The wave of cells passes once. It plays the whole splash exit, sped up. Every cell has erased the picture before it ends. */
export const TRANSITION_MS = 700

/** Splash milliseconds that pass in one real millisecond. */
export const SPLASH_SPEED = EXIT_END_MS / TRANSITION_MS
