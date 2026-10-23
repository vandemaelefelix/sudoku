import { useEffect, useLayoutEffect, useRef } from 'react'

export type KeyHandlers = Partial<Record<string, (event: KeyboardEvent) => void>>

/** True when the key goes to a text field. */
export function typingIn(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  return target !== null && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
}

/** The keys of a step. A key is `event.key` in lower case. `digit` takes 0 to 9. */
export function useKeys(handlers: KeyHandlers, active = true): void {
  // A ref, so a handler sees the newest state without a new listener on each render.
  const current = useRef(handlers)
  useLayoutEffect(() => {
    current.current = handlers
  })
  useEffect(() => {
    if (!active) return undefined
    const onKey = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (typingIn(event)) return
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
      const handler = current.current[key] ?? (/^[0-9]$/.test(key) ? current.current.digit : undefined)
      if (handler) {
        event.preventDefault()
        handler(event)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])
}
