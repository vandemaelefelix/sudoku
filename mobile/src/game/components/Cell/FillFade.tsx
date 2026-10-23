import { useEffect, useState } from 'react'
import { StyleSheet as RNStyleSheet, View } from 'react-native'
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { FILL_FADE_MS } from '@/game/constants/mark.constants'
import { displayFill, type CellView } from '@/game/utils/cell.utils'
import { easeOut } from '@/utils/motion.utils'
import { styles } from './Cell.styles'

type Fill = CellView['fill']

/** The new fill over the old one. It starts clear after a change and fades in. A fade moves nothing, so Reduce Motion keeps it. */
function FillOver({ cell, fill, fade }: { cell: number; fill: Fill; fade: boolean }) {
  const { theme } = useUnistyles()
  const opacity = useSharedValue(fade ? 0 : 1)
  useEffect(() => {
    if (fade) opacity.set(withTiming(1, { duration: FILL_FADE_MS, easing: easeOut, reduceMotion: ReduceMotion.Never }))
  }, [fade, opacity])
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }))
  return (
    <Animated.View testID={`cell-${cell}-fill-fade`} style={[RNStyleSheet.absoluteFill, style]}>
      <View testID={`cell-${cell}-fill`} style={[styles.fillLayer, displayFill(theme.components.cell, fill)]} />
    </Animated.View>
  )
}

/**
 * The fill of a display cell, which crossfades on a change. The colours come from the theme hook, not from the cell
 * styles: after Settings opens a second time, Unistyles no longer updates the fill styles of the preview on a theme
 * switch. Only a display grid renders this, so the cells of a game still read no theme hook (ADR-015).
 */
export function FillFade({ cell, fill }: { cell: number; fill: Fill }) {
  const { theme } = useUnistyles()
  const [layers, setLayers] = useState({ under: fill, over: fill })
  if (layers.over !== fill) setLayers({ under: layers.over, over: fill })
  return (
    <>
      <View
        testID={`cell-${cell}-fill-under`}
        style={[styles.fillLayer, displayFill(theme.components.cell, layers.under)]}
      />
      <FillOver key={layers.over} cell={cell} fill={layers.over} fade={layers.under !== layers.over} />
    </>
  )
}
