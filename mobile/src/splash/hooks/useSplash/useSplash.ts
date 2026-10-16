import { createContext, use, useEffect } from 'react'

export type SplashPhase = 'intro' | 'exit' | 'done'

export type SplashState = { phase: SplashPhase; markReady(): void }

// Without a provider, in a test for example, the splash is done and ignores the signal.
export const SplashContext = createContext<SplashState>({ phase: 'done', markReady: () => undefined })

export function useSplash(): SplashState {
  return use(SplashContext)
}

/** Tell the splash that the first screen is ready. The exit of the splash waits for this. */
export function useSplashReady(ready: boolean): void {
  const { markReady } = useSplash()
  useEffect(() => {
    if (ready) markReady()
  }, [ready, markReady])
}
