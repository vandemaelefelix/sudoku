import type { TechniqueId } from '@sudoku/core'
import { View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { HintCard } from '@/game/components/HintCard'
import { Keypad } from '@/game/components/Keypad'
import { Tools } from '@/game/components/Tools'
import { HINT_SLIDE } from '@/game/constants/hint.constants'
import { useEased } from '@/game/hooks/useEased'
import { useGameState } from '@/game/hooks/useGameState'

type DockProps = {
  /** "Learn more" on the hint card. */
  onLearn?: ((technique: TechniqueId) => void) | undefined
}

/**
 * The tool row and the keypad, or the hint card in their place (ADR-032, amendment of 2026-10-22). The tool row and the
 * keypad stay in the layout under the card, so the dock keeps its height and the grid does not move. They sink and fade
 * while the card rises. With Reduce Motion, both only fade.
 */
export function Dock({ onLearn }: DockProps) {
  const { hint } = useGameState()
  const { theme } = useUnistyles()
  const reduceMotion = useReducedMotion()
  const open = hint !== null
  const away = useEased(open ? 1 : 0, theme.motion.medium)
  const slide = reduceMotion ? 0 : HINT_SLIDE
  const controlsStyle = useAnimatedStyle(() => ({
    opacity: 1 - away.get(),
    transform: [{ translateY: away.get() * slide }],
  }))
  return (
    <View testID="dock">
      <Animated.View
        testID="dock-controls"
        style={controlsStyle}
        pointerEvents={open ? 'none' : 'auto'}
        accessibilityElementsHidden={open}
        importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}
      >
        <Tools />
        <Keypad />
      </Animated.View>
      {hint !== null && <HintCard hint={hint} onLearn={onLearn} />}
    </View>
  )
}
