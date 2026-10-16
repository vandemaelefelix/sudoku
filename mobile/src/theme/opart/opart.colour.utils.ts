/** The red, green and blue of a #rrggbb colour, as numbers 0 to 255. */
function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)) as [number, number, number]
}

/** The red, green and blue of a #rrggbb colour, for an rgba() colour. */
export function rgb(hex: string): string {
  return channels(hex).join(',')
}

/** `from` moved toward `to` by t, 0 to 1. Both are #rrggbb. */
export function mixHex(from: string, to: string, t: number): string {
  const target = channels(to)
  const mixed = channels(from).map((value, i) => Math.round(value + (target[i]! - value) * t))
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`
}
