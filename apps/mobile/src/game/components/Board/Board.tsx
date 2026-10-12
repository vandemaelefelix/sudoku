import { useState } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import { Grid } from '@/game/components/Grid'
import { styles } from './Board.styles'

/** The space between the header and the tools. The grid takes the largest square that fits. */
export function Board() {
  const [side, setSide] = useState(0)
  const measure = ({ nativeEvent }: LayoutChangeEvent) =>
    setSide(Math.floor(Math.min(nativeEvent.layout.width, nativeEvent.layout.height)))
  return (
    <View testID="board" style={styles.board} onLayout={measure}>
      <View testID="board-square" style={{ width: side, height: side }}>
        {side > 0 && <Grid />}
      </View>
    </View>
  )
}
