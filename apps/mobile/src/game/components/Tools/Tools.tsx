import { Pressable, View } from 'react-native'
import { Icon, type IconName } from '@/game/components/Icon'
import { useGame } from '@/game/hooks/useGame'
import { canErase, canUndo } from '@/game/utils/session.utils'
import { styles } from './Tools.styles'

type ToolProps = { icon: IconName; label: string; enabled: boolean; selected?: boolean; onPress(): void }

function Tool({ icon, label, enabled, selected = false, onPress }: ToolProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled, selected }}
      disabled={!enabled}
      onPress={onPress}
      style={[styles.tool, !enabled && styles.disabled, selected && styles.notesOn]}
    >
      <Icon name={icon} tone={selected ? 'accent' : 'text'} />
    </Pressable>
  )
}

export function Tools() {
  const { game, notesMode, actions } = useGame()
  const playing = game.status === 'playing'
  return (
    <View style={[styles.tools, !playing && styles.locked]}>
      <Tool icon="undo" label="Undo" enabled={canUndo(game)} onPress={actions.undo} />
      <Tool icon="erase" label="Erase" enabled={canErase(game)} onPress={actions.erase} />
      <Tool icon="notes" label="Notes" enabled={playing} selected={notesMode} onPress={actions.toggleNotesMode} />
      <Tool icon="hint" label="Hint" enabled={playing} onPress={actions.hint} />
    </View>
  )
}
