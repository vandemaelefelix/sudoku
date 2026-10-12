import { Pressable, Text, View } from 'react-native'
import type { Digit } from '@sudoku/core'
import type { CellLook } from '@/scan/utils/correction.utils'
import { cellPlace, type EntryKind } from '@/scan/utils/correctionEdit.utils'
import { KIND_HIT_SLOP, KINDS, PAD_ROWS } from './CorrectionPad.constants'
import { styles } from './CorrectionPad.styles'

type CorrectionPadProps = {
  /** The index of the selected cell, row-major. */
  cell: number
  look: CellLook
  onDigit(digit: Digit): void
  onClear(): void
  onKind(kind: EntryKind): void
  onDone(): void
}

/** The panel content while a cell is selected: the given / entry switch, Done, the digits and Clear. */
export function CorrectionPad({ cell, look, onDigit, onClear, onKind, onDone }: CorrectionPadProps) {
  const empty = look.style === 'empty'
  // The pad replaces the panel content, so each control says which cell it changes.
  const hint = `Changes ${cellPlace(cell).toLowerCase()}`
  return (
    <View testID="correction-pad" style={styles.pad}>
      <View testID="correction-pad-kinds" style={styles.row}>
        <View accessibilityRole="radiogroup" style={styles.kinds}>
          {KINDS.map(({ kind, label }) => {
            const on = look.style === kind
            return (
              <Pressable
                key={kind}
                testID={`correction-kind-${kind}`}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityHint={hint}
                hitSlop={KIND_HIT_SLOP}
                accessibilityState={{ checked: on, disabled: empty }}
                disabled={empty}
                onPress={() => onKind(kind)}
                style={[styles.kind, on && styles.kindOn, empty && styles.disabled]}
              >
                <Text style={on ? styles.kindTextOn : styles.kindText}>{label}</Text>
              </Pressable>
            )
          })}
        </View>
        <Pressable
          testID="correction-done"
          accessibilityRole="button"
          accessibilityLabel="Done"
          onPress={onDone}
          style={styles.done}
        >
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
      {PAD_ROWS.map((digits, row) => (
        <View key={digits[0]} testID={`correction-pad-row-${row}`} style={styles.row}>
          {digits.map((digit) => (
            <Pressable
              key={digit}
              testID={`correction-key-${digit}`}
              accessibilityRole="button"
              accessibilityLabel={`Set ${digit}`}
              accessibilityHint={hint}
              onPress={() => onDigit(digit)}
              style={styles.key}
            >
              <Text style={styles.keyText}>{digit}</Text>
            </Pressable>
          ))}
          {row === PAD_ROWS.length - 1 && (
            <Pressable
              testID="correction-clear"
              accessibilityRole="button"
              accessibilityLabel="Clear the cell"
              accessibilityHint={hint}
              onPress={onClear}
              style={styles.key}
            >
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  )
}
