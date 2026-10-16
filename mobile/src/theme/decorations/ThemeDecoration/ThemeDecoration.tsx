import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import type { DecorationSlot } from '@/theme/decorations/decorations.types'
import { DECORATIONS } from '@/theme/decorations/registry'

type ThemeDecorationProps = {
  slot: DecorationSlot
  /** The place of the decoration in its parent. An empty slot renders no box, so this style takes no space. */
  style?: StyleProp<ViewStyle>
}

/** Draws what the current theme puts in the slot, or nothing. Only this component re-renders on a theme switch. */
export function ThemeDecoration({ slot, style }: ThemeDecorationProps) {
  const { theme } = useUnistyles()
  const Decoration = DECORATIONS[theme.name][slot]
  if (!Decoration) return null
  return style === undefined ? (
    <Decoration />
  ) : (
    <View pointerEvents="none" style={style}>
      <Decoration />
    </View>
  )
}
