/**
 * The whole seconds of a time played. It rounds down, like the timer on the game screen: a time never shows a second
 * that has not passed. Rounding up would turn 59 999 ms into 00:60 and make the finish card disagree with the timer.
 */
export function wholeSeconds(ms: number): number {
  return Math.floor(ms / 1000)
}

const twoDigits = (value: number) => String(value).padStart(2, '0')

/** Minutes and seconds, for example 04:12. Minutes go past 59: the timer has no hours. */
export function formatClock(ms: number): string {
  const seconds = wholeSeconds(ms)
  return `${twoDigits(Math.floor(seconds / 60))}:${twoDigits(seconds % 60)}`
}
