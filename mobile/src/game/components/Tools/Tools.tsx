import { Pressable } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { Icon, type IconName } from '@/game/components/Icon'
import { useEased } from '@/game/hooks/useEased'
import { useGameActions } from '@/game/hooks/useGameActions'
import { useGameState } from '@/game/hooks/useGameState'
import { canErase, canUndo } from '@/game/utils/session.utils'
import { useHaptics } from '@/settings/hooks/useHaptics'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './Tools.styles'

type ToolProps = {
  icon: IconName
  label: string
  enabled: boolean
  playing: boolean
  selected?: boolean
  onPress(): void
}

/** A disabled tool fades out, and the notes fill fades in, so a change of state never jumps. */
function Tool({ icon, label, enabled, playing, selected = false, onPress }: ToolProps) {
  const { theme } = useUnistyles()
  // A locked board dims the whole row, so a tool dims on its own only while the game is played.
  const opacity = useEased(enabled || !playing ? 1 : theme.opacity.disabled)
  const fill = useEased(selected ? 1 : 0)
  const toolStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }))
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.get() }))
  return (
    <Animated.View style={toolStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !enabled, selected }}
        disabled={!enabled}
        onPress={onPress}
        style={({ pressed }) => [styles.tool, pressed && pressedStyles.pressed]}
      >
        <Animated.View testID={`tool-${icon}-fill`} style={[styles.notesOn, fillStyle]} pointerEvents="none" />
        <Icon name={icon} tone={selected ? 'accent' : 'text'} />
      </Pressable>
    </Animated.View>
  )
}

export function Tools() {
  const { board, notesMode } = useGameState()
  const actions = useGameActions()
  const { play } = useHaptics()
  const { theme } = useUnistyles()
  const playing = board.status === 'playing'
  const rowOpacity = useEased(playing ? 1 : theme.opacity.locked)
  const rowStyle = useAnimatedStyle(() => ({ opacity: rowOpacity.get() }))
  const toggleNotes = () => {
    play('tick')
    actions.toggleNotesMode()
  }
  return (
    <Animated.View testID="tools" style={[styles.tools, rowStyle]}>
      <Tool icon="undo" label="Undo" enabled={canUndo(board)} playing={playing} onPress={actions.undo} />
      <Tool icon="erase" label="Erase" enabled={canErase(board)} playing={playing} onPress={actions.erase} />
      <Tool icon="notes" label="Notes" enabled={playing} playing={playing} selected={notesMode} onPress={toggleNotes} />
      <Tool icon="hint" label="Hint" enabled={playing} playing={playing} onPress={actions.hint} />
    </Animated.View>
  )
}
