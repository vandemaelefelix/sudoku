import { useLayoutEffect, useRef, useState } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import { Grid } from '@/game/components/Grid'
import { PauseLayer } from '@/game/components/PauseLayer'
import { styles } from './Board.styles'

const squareIn = (width: number, height: number) => Math.floor(Math.min(width, height))

/**
 * The space between the header and the tools. The grid takes the largest square that fits.
 * Board reads no game state, so a move renders only the grid and the pause layer.
 */
export function Board() {
  const board = useRef<View>(null)
  const [side, setSide] = useState(0)
  // The new architecture knows the layout before the first paint. A state set here renders before that paint,
  // so the grid is on the screen while the route slides in. onLayout comes a frame later, and follows a resize.
  useLayoutEffect(() => {
    const box = board.current?.getBoundingClientRect?.()
    if (box !== undefined) setSide(squareIn(box.width, box.height))
  }, [])
  const measure = ({ nativeEvent }: LayoutChangeEvent) =>
    setSide(squareIn(nativeEvent.layout.width, nativeEvent.layout.height))
  return (
    <View ref={board} testID="board" style={styles.board} onLayout={measure}>
      <View testID="board-square" style={{ width: side, height: side }}>
        {side > 0 && <Grid />}
        {side > 0 && <PauseLayer />}
      </View>
    </View>
  )
}
