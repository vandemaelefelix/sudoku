import { makeImageFromView, type SkImage } from '@shopify/react-native-skia'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { devLog, errorMessage } from '@/utils/log.utils'
import { ThemeCellWave } from './ThemeCellWave'
import { ThemeTransitionContext, type ThemeTarget, type ThemeTransition } from './useThemeTransition'

type Running = { image: SkImage; target: ThemeTarget }

/**
 * Owns the cell wave over a theme switch (ADR-025). It sits at the root. It takes a picture of the app, draws the picture
 * over every screen and switches the theme under it. A wave of splash cells then rises over the picture.
 * Each cell covers the old screen, erases it and fades out, so the new theme shows behind the wave.
 * A second switch while one runs is refused. With Reduce Motion, or when the picture fails, the theme switches at once.
 * A native modal is not part of the picture.
 */
export function ThemeTransitionProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  const appRef = useRef<View>(null)
  const [running, setRunning] = useState<Running | null>(null)
  const pending = useRef<(() => void) | null>(null)
  const busy = useRef(false)

  const applyPending = useCallback(() => {
    const apply = pending.current
    pending.current = null
    apply?.()
  }, [])

  const onDone = useCallback(() => {
    // The switch happens when the picture is on screen. If that step never arrived, the new theme must still apply.
    applyPending()
    busy.current = false
    setRunning(null)
  }, [applyPending])

  // The picture outlives the overlay. The cleanup runs after the overlay is gone, and one frame later still, so no frame
  // that the UI thread draws can reach a freed picture.
  useEffect(() => {
    if (running === null) return
    const { image } = running
    return () => {
      requestAnimationFrame(() => image.dispose())
    }
  }, [running])

  const start = useCallback<ThemeTransition['start']>(
    (next, apply) => {
      if (reduced) {
        apply()
        return true
      }
      if (busy.current) return false
      busy.current = true
      pending.current = apply
      makeImageFromView(appRef)
        .then((image) => {
          if (image === null) throw new Error('no picture')
          setRunning({ image, target: next })
        })
        .catch((error: unknown) => {
          devLog('theme', `no picture of the screen, the theme switches at once: ${errorMessage(error)}`)
          applyPending()
          busy.current = false
        })
      return true
    },
    [reduced, applyPending],
  )

  const value = useMemo(() => ({ start }), [start])
  return (
    <ThemeTransitionContext value={value}>
      {/* collapsable false: the picture needs a real native view. The overlay is a sibling, so the picture never shows it. */}
      <View ref={appRef} collapsable={false} style={styles.app}>
        {children}
      </View>
      {running !== null && (
        <ThemeCellWave image={running.image} target={running.target} onSwitch={applyPending} onDone={onDone} />
      )}
    </ThemeTransitionContext>
  )
}

const styles = StyleSheet.create({ app: { flex: 1 } })
