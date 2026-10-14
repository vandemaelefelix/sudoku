import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useRef } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { Easing, ReduceMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { SplashCells } from '@/splash/components/SplashCells'
import { SplashWord } from '@/splash/components/SplashWord'
import { EXIT_END_MS, INTRO_END_MS } from '@/splash/constants/splash.constants'
import { useSplash } from '@/splash/hooks/useSplash'
import { SPLASH_COLORS } from '@/theme/splash.colors'

// Linear time: every part applies its own delay and curve. Never: with Reduce Motion the provider draws no overlay.
const linear = (to: number) => withTiming(to, { duration: to, easing: Easing.linear, reduceMotion: ReduceMotion.Never })

/**
 * The splash animation (ADR-024). It draws the splash ground first, so its first frame equals the native splash.
 * The intro clock starts at the mount. The exit clock starts when the provider says exit. The overlay takes no touch.
 */
export function SplashOverlay() {
  const { phase } = useSplash()
  const { rt } = useUnistyles()
  const { width, height } = useWindowDimensions()
  const colors = SPLASH_COLORS[rt.colorScheme === 'dark' ? 'dark' : 'light']
  const intro = useSharedValue(0)
  const exit = useSharedValue(0)
  const hidden = useRef(false)

  useEffect(() => {
    intro.set(linear(INTRO_END_MS))
  }, [intro])

  useEffect(() => {
    if (phase === 'exit') exit.set(linear(EXIT_END_MS))
  }, [phase, exit])

  // The first layout means the ground is on screen, so the native splash can go. A second frame is enough for Skia.
  const onLayout = () => {
    if (hidden.current) return
    hidden.current = true
    requestAnimationFrame(() => SplashScreen.hide())
  }

  if (phase === 'done') return null
  return (
    <View testID="splash-overlay" pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {/* The first frame needs no Skia: a plain view draws the ground at once. The picture draws it after that. */}
      {phase === 'intro' && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.ground }]} />}
      <SplashCells
        exit={exit}
        width={width}
        height={height}
        ground={colors.ground}
        tint={colors.tint}
        line={colors.line}
      />
      <SplashWord intro={intro} exit={exit} color={colors.word} />
    </View>
  )
}
