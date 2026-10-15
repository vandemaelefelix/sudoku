/**
 * The ground of the splash. The native layer cannot read the saved theme, so the native splash and the first frame
 * of the animation are white in every look (ADR-024, ADR-025, ADR-026). app.json holds the same value: a test keeps the two the same.
 * The overlay then fades the ground to the page colour of the saved theme. The word and the cells take their colours from that theme.
 */
export const SPLASH_GROUND = '#ffffff'
