const HEX = /^#[0-9a-f]{6}$/i

function linearChannel(hex: string, start: number): number {
  const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  if (!HEX.test(hex)) throw new Error(`Expected a #rrggbb colour, got ${hex}`)
  return 0.2126 * linearChannel(hex, 1) + 0.7152 * linearChannel(hex, 3) + 0.0722 * linearChannel(hex, 5)
}

/** The WCAG 2.2 contrast ratio, 1 to 21. Both colours are opaque #rrggbb. */
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
