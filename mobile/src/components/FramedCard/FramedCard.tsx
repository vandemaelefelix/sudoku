import { Children, isValidElement, type ReactNode } from 'react'
import { View } from 'react-native'
import { styles } from './FramedCard.styles'

type FramedCardProps = {
  /** A Fragment counts as one child, so a Fragment gets no line inside. */
  children: ReactNode
  /** A line between two children, in the weight of the box lines of the grid. A card with one body turns it off. Default true. */
  divided?: boolean
  /** The surface colour behind the children. Default true. */
  filled?: boolean
  testID?: string
}

/** The frame of a group on a secondary screen: the tokens of `components.summary` (ADR-026). */
export function FramedCard({ children, divided = true, filled = true, testID }: FramedCardProps) {
  return (
    <View testID={testID} style={[styles.card, filled && styles.filled]}>
      {divided
        ? Children.toArray(children).map((child, index) => (
            <View key={isValidElement(child) ? child.key : index}>
              {child}
              {/* An overlay, so the line takes no height from the row. */}
              {index > 0 && <View pointerEvents="none" style={styles.rule} />}
            </View>
          ))
        : children}
    </View>
  )
}
