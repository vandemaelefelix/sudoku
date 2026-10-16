import type { SkImage } from '@shopify/react-native-skia'
import { useRef } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { Easing, ReduceMotion, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { SplashCells } from '@/splash/components/SplashCells'
import { SPLASH_GROUND } from '@/theme/splash.colors'
import { THEMES } from '@/theme/themes/registry'
import { TRANSITION_MS } from './transition.constants'
import { splashMs } from './transition.utils'
import type { ThemeTarget } from './useThemeTransition'

type ThemeCellWaveProps = {
  /**
   * A picture of the old screen. The caller keeps it alive until this component is gone and no frame can draw it.
   * It shows at full strength at the start, so the player sees no change.
   */
  image: SkImage
  /**
   * The theme that the switch goes to. The overlay draws before the switch, so it cannot read the current theme.
   * The cells take the tint of the colourway in its Light variant, over a white base, in both appearances. They are
   * a decoration over the picture, and the Light accent is the colour of the colourway on white (ADR-026).
   */
  target: ThemeTarget
  /** Called once, when the picture is on screen. The theme switches under it. The clock of the wave starts then. */
  onSwitch(): void
  onDone(): void
}

/**
 * The effect over a theme switch (ADR-025): the splash wave of cells, in the colours of the new theme, rises over the picture
 * of the old screen. Each cell covers the old screen, erases it and fades out, so the new theme, already switched, shows behind the wave.
 * The wave passes once. The theme switches under the overlay when it starts.
 * Linear time: the cells apply their own curves. Never: with Reduce Motion the provider draws no overlay.
 */
export function ThemeCellWave({ image, target, onSwitch, onDone }: ThemeCellWaveProps) {
  const { width, height } = useWindowDimensions()
  const clock = useSharedValue(0)
  const started = useRef(false)
  const { accent, line } = THEMES[target.name].colors

  // The first layout means the picture is on screen, so the theme can switch under it. One more frame is enough for Skia.
  const onLayout = () => {
    if (started.current) return
    started.current = true
    requestAnimationFrame(() => {
      onSwitch()
      clock.set(
        withTiming(
          TRANSITION_MS,
          { duration: TRANSITION_MS, easing: Easing.linear, reduceMotion: ReduceMotion.Never },
          (finished) => {
            if (finished) scheduleOnRN(onDone)
          },
        ),
      )
    })
  }

  const exit = useDerivedValue(() => splashMs(clock.get()))

  return (
    <View testID="theme-cell-wave" pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      <SplashCells
        exit={exit}
        groundImage={image}
        width={width}
        height={height}
        ground={SPLASH_GROUND}
        tint={accent}
        line={line}
      />
    </View>
  )
}
