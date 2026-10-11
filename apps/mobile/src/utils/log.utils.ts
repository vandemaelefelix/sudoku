/** The message of an Error, or the value as text. Safe to call in a worklet. */
export function errorMessage(error: unknown): string {
  'worklet'
  return error instanceof Error ? error.message : String(error)
}

/** Logs `[tag] message` in a development build only. */
export function devLog(tag: string, message: string): void {
  if (__DEV__) console.log(`[${tag}] ${message}`)
}

/** Warns `[tag] message` in a development build only. */
export function devWarn(tag: string, message: string): void {
  if (__DEV__) console.warn(`[${tag}] ${message}`)
}
