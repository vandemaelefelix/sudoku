import * as SplashScreen from 'expo-splash-screen'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'react-native-reanimated'
import { EXIT_END_MS, INTRO_END_MS, MAX_WAIT_MS } from '@/splash/constants/splash.constants'
import { SplashContext, type SplashPhase } from '@/splash/hooks/useSplash'

// Expo wants this call in the global scope, before the first render. It keeps the native splash until the overlay hides it.
SplashScreen.preventAutoHideAsync().catch(() => undefined)

/**
 * Owns the phase of the splash: the intro runs at once. The exit starts when the intro is done and a screen calls
 * markReady, or after MAX_WAIT_MS. With Reduce Motion the phase is done from the start (ADR-023).
 */
export function SplashProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  const [ready, setReady] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const [finished, setFinished] = useState(false)
  const markReady = useCallback(() => setReady(true), [])

  useEffect(() => {
    const id = setTimeout(markReady, MAX_WAIT_MS)
    return () => clearTimeout(id)
  }, [markReady])

  useEffect(() => {
    const id = setTimeout(() => setIntroDone(true), INTRO_END_MS)
    return () => clearTimeout(id)
  }, [])

  const phase: SplashPhase = reduced || finished ? 'done' : ready && introDone ? 'exit' : 'intro'

  useEffect(() => {
    if (phase !== 'exit') return
    const id = setTimeout(() => setFinished(true), EXIT_END_MS)
    return () => clearTimeout(id)
  }, [phase])

  // There is no overlay to hide the native splash, so the first screen does it.
  useEffect(() => {
    if (reduced && ready) SplashScreen.hide()
  }, [reduced, ready])

  const value = useMemo(() => ({ phase, markReady }), [phase, markReady])
  return <SplashContext value={value}>{children}</SplashContext>
}
