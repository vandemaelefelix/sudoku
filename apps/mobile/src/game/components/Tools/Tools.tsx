import { Pressable, View } from 'react-native'
import { Icon, type IconName } from '@/game/components/Icon'
import { useGameActions } from '@/game/hooks/useGameActions'
import { useGameState } from '@/game/hooks/useGameState'
import { canErase, canUndo } from '@/game/utils/session.utils'
import { styles } from './Tools.styles'

type ToolProps = {
  icon: IconName
  label: string
  enabled: boolean
  playing: boolean
  selected?: boolean
  onPress(): void
}

function Tool({ icon, label, enabled, playing, selected = false, onPress }: ToolProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled, selected }}
      disabled={!enabled}
      onPress={onPress}
      style={[styles.tool, !enabled && playing && styles.disabled, selected && styles.notesOn]}
    >
      <Icon name={icon} tone={selected ? 'accent' : 'text'} />
    </Pressable>
  )
}

export function Tools() {
  const { board, notesMode } = useGameState()
  const actions = useGameActions()
  const playing = board.status === 'playing'
  return (
    <View style={[styles.tools, !playing && styles.locked]}>
      <Tool icon="undo" label="Undo" enabled={canUndo(board)} playing={playing} onPress={actions.undo} />
      <Tool icon="erase" label="Erase" enabled={canErase(board)} playing={playing} onPress={actions.erase} />
      <Tool
        icon="notes"
        label="Notes"
        enabled={playing}
        playing={playing}
        selected={notesMode}
        onPress={actions.toggleNotesMode}
      />
      <Tool icon="hint" label="Hint" enabled={playing} playing={playing} onPress={actions.hint} />
    </View>
  )
}
