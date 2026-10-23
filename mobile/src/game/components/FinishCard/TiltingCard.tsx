import type { ReactNode, RefObject } from 'react'
import type { View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useCardTilt } from '@/game/hooks/useCardTilt'
import { styles } from './FinishCard.styles'

type TiltingCardProps = {
  cardRef: RefObject<View | null>
  label: string
  shineTravel: number
  children: ReactNode
}

/** A separate component: useCardTilt starts the sensor, and with Reduce Motion on the sensor must not start (ADR-017). */
export function TiltingCard({ cardRef, label, shineTravel, children }: TiltingCardProps) {
  const { cardStyle, shineStyle, spotStyle } = useCardTilt(shineTravel)
  return (
    <Animated.View
      ref={cardRef}
      testID="finish-card"
      style={[styles.card, cardStyle]}
      accessible
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.shine, shineStyle]} pointerEvents="none" />
      <Animated.View style={[styles.spot, spotStyle]} pointerEvents="none" />
      {children}
    </Animated.View>
  )
}
