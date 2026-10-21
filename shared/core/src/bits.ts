export function bitCount(mask: number): number {
  let count = 0
  for (let rest = mask; rest !== 0; rest &= rest - 1) count++
  return count
}
