import { memo } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { CellView } from '@/game/utils/cell.utils'
import { NOTE_PLACES } from './Cell.constants'
import { styles } from './Cell.styles'

type CellProps = CellView & { cell: number; label: string; onSelect(cell: number): void }

/** One cell. Only primitive props, so memo skips the cells a move does not change. */
export const Cell = memo(function Cell({ cell, digit, digitStyle, notes, fill, ring, label, onSelect }: CellProps) {
  return (
    <Pressable
      testID={`cell-${cell}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onSelect(cell)}
      style={[styles.cell, styles[fill], ring && styles.ring]}
    >
      {digit !== 0 && (
        <Text allowFontScaling={false} style={styles[digitStyle]}>
          {digit}
        </Text>
      )}
      {digit === 0 && notes !== '' && (
        <View style={styles.notes}>
          {NOTE_PLACES.map((place) => (
            <View key={place} testID={`note-slot-${place}`} style={styles.noteSlot}>
              {notes.includes(place) && (
                <Text allowFontScaling={false} style={styles.note}>
                  {place}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </Pressable>
  )
})
