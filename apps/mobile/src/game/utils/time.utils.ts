const twoDigits = (value: number) => String(value).padStart(2, '0')

/** Minutes and seconds, for example 04:12. Minutes go past 59: the timer has no hours. */
export function formatClock(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  return `${twoDigits(Math.floor(seconds / 60))}:${twoDigits(seconds % 60)}`
}
