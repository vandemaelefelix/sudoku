import { createHash, timingSafeEqual } from 'node:crypto'

const digest = (value: string) => createHash('sha256').update(value).digest()

// SUD-11: the key is a speed bump, not a secret. The compare still runs in constant time.
export function hasAppKey(given: string | undefined, expected: string): boolean {
  if (!given || !expected) return false
  return timingSafeEqual(digest(given), digest(expected))
}
