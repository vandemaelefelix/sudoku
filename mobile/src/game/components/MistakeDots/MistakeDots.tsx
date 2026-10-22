import { View } from 'react-native'
import Animated, { LayoutAnimationConfig, ZoomIn } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { MAX_MISTAKES } from '@sudoku/core'
import { useGameState } from '@/game/hooks/useGameState'
import { easeOut } from '@/utils/motion.utils'
import { styles } from './MistakeDots.styles'
import { useIntl } from '@/i18n/hooks/useIntl'

const DOTS = Array.from({ length: MAX_MISTAKES }, (_, dot) => dot)

/**
 * One dot fills for each mistake. The fill grows from the centre, so the eye finds the header.
 * skipEntering: the dots of a resumed game are filled at once. The haptic of a mistake comes from useMoveHaptics.
 */
export function MistakeDots() {
  const intl = useIntl()
  const { mistakes } = useGameState().board
  const { theme } = useUnistyles()
  return (
    <View
      style={styles.dots}
      accessible
      accessibilityLabel={intl.formatMessage({ id: 'game.mistakesOf' }, { count: mistakes, max: MAX_MISTAKES })}
    >
      <LayoutAnimationConfig skipEntering>
        {DOTS.map((dot) => (
          <View
            key={dot}
            testID={`mistake-dot-${dot}`}
            style={[styles.dot, dot < mistakes ? styles.filled : styles.empty]}
          >
            {dot < mistakes && (
              <Animated.View
                testID={`mistake-dot-${dot}-fill`}
                entering={ZoomIn.duration(theme.motion.medium).easing(easeOut)}
                style={styles.fill}
              />
            )}
          </View>
        ))}
      </LayoutAnimationConfig>
    </View>
  )
}
