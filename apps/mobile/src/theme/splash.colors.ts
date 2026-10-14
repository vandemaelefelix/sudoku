/**
 * The colours of the splash, in light and dark mode. The native layer cannot read the saved theme,
 * so the splash follows the system appearance (ADR-024). The values come from the Op-art and Midnight palettes.
 * ground is also the native splash colour in app.json: a test keeps the two the same.
 */
export const SPLASH_COLORS = {
  light: { ground: '#ffffff', word: '#0f1d5c', tint: '#1f3fd1', line: '#d3d9f7' },
  dark: { ground: '#0f1116', word: '#e7e9ef', tint: '#84a0ff', line: '#272b35' },
} as const

export type SplashScheme = keyof typeof SPLASH_COLORS
