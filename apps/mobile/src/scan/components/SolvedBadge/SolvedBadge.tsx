import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated'
import { Icon } from '@/game/components/Icon'
import { SHARED_MOTION } from '@/theme/shared.tokens'
import { easeOut } from '@/utils/motion.utils'
import { styles } from './SolvedBadge.styles'

const BADGE_DELAY_MS = 300
const IN = ZoomIn.duration(SHARED_MOTION.medium).easing(easeOut).delay(BADGE_DELAY_MS).reduceMotion(ReduceMotion.System)

/** The mark of a solved scan, in the title block. With Reduce Motion it appears at once. */
export function SolvedBadge() {
  return (
    <Animated.View
      testID="solved-badge"
      // The title next to it says "Solved", so VoiceOver skips the badge.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      entering={IN}
      style={styles.badge}
    >
      <Icon name="check" tone="onAccent" />
    </Animated.View>
  )
}
