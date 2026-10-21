import { makeImageFromView, type SkImage } from '@shopify/react-native-skia'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { UnistylesRuntime } from 'react-native-unistyles'
import { unistylesName } from '@/theme/preference'
import { devLog, errorMessage } from '@/utils/log.utils'
import { ThemeCellWave } from './ThemeCellWave'
import { ThemeTransitionContext, type ThemeTarget, type ThemeTransition } from './useThemeTransition'

// id: one per wave, so a wave that follows another one mounts a new overlay.
type Running = { id: number; image: SkImage; target: ThemeTarget }
// at: the time of the choice, in ms, so a choice that waited keeps only the rest of its settle time.
type Choice = { target: ThemeTarget; apply: () => void; settleMs: number; at: number }

const isOnScreen = ({ name, appearance }: ThemeTarget) => UnistylesRuntime.themeName === unistylesName(name, appearance)

/**
 * Owns the cell wave over a theme switch (ADR-025). It sits at the root. It takes a picture of the app, draws the picture
 * over every screen and switches the theme under it. A wave of splash cells then rises over the picture.
 * Each cell covers the old screen, erases it and fades out, so the new theme shows behind the wave.
 * The caller can delay the picture until a motion on screen ends. A switch while one waits or runs is kept, and only the
 * last one: it starts when the running wave ends. A switch to the look on screen plays no wave.
 * With Reduce Motion, or when the picture fails, the theme switches at once.
 * A native modal is not part of the picture.
 */
export function ThemeTransitionProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  const appRef = useRef<View>(null)
  const [running, setRunning] = useState<Running | null>(null)
  const pending = useRef<(() => void) | null>(null)
  const busy = useRef(false)
  const waiting = useRef<Choice | null>(null)
  const runs = useRef(0)
  // begin and finish call each other, so finish reaches begin through this ref.
  const beginRef = useRef<(choice: Choice) => void>(() => {})

  const applyPending = useCallback(() => {
    const apply = pending.current
    pending.current = null
    apply?.()
  }, [])

  const finish = useCallback(() => {
    busy.current = false
    const next = waiting.current
    waiting.current = null
    if (next === null) return
    if (isOnScreen(next.target)) next.apply()
    else beginRef.current(next)
  }, [])

  const begin = useCallback(
    ({ target, apply, settleMs, at }: Choice) => {
      busy.current = true
      pending.current = apply
      const capture = () => {
        makeImageFromView(appRef)
          .then((image) => {
            if (image === null) throw new Error('no picture')
            setRunning({ id: ++runs.current, image, target })
          })
          .catch((error: unknown) => {
            devLog('theme', `no picture of the screen, the theme switches at once: ${errorMessage(error)}`)
            applyPending()
            finish()
          })
      }
      const settle = settleMs - (Date.now() - at)
      if (settle > 0) setTimeout(capture, settle)
      else capture()
    },
    [applyPending, finish],
  )

  useEffect(() => {
    beginRef.current = begin
  }, [begin])

  const onDone = useCallback(() => {
    // The switch happens when the picture is on screen. If that step never arrived, the new theme must still apply.
    applyPending()
    setRunning(null)
    finish()
  }, [applyPending, finish])

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
    (target, apply, settleMs = 0) => {
      if (reduced) {
        apply()
        return
      }
      const choice = { target, apply, settleMs, at: Date.now() }
      if (busy.current) waiting.current = choice
      else if (isOnScreen(target)) apply()
      else begin(choice)
    },
    [reduced, begin],
  )

  const value = useMemo(() => ({ start }), [start])
  return (
    <ThemeTransitionContext value={value}>
      {/* collapsable false: the picture needs a real native view. The overlay is a sibling, so the picture never shows it. */}
      <View ref={appRef} collapsable={false} style={styles.app}>
        {children}
      </View>
      {running !== null && (
        <ThemeCellWave
          key={running.id}
          image={running.image}
          target={running.target}
          onSwitch={applyPending}
          onDone={onDone}
        />
      )}
    </ThemeTransitionContext>
  )
}

const styles = StyleSheet.create({ app: { flex: 1 } })
