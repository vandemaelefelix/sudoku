import { Pressable, Text, View } from 'react-native'
import type { Digit } from '@sudoku/core'
import { useIntl } from '@/i18n/hooks/useIntl'
import type { CellLook } from '@/scan/utils/correction.utils'
import { cellRowColumn } from '@/scan/utils/correctionEdit.utils'
import { PAD_ROWS } from './CorrectionPad.constants'
import { styles } from './CorrectionPad.styles'

type CorrectionPadProps = {
  /** The index of the open cell, row-major. */
  cell: number
  look: CellLook
  /** The second guess of the model, marked with a dashed ring. Null for none. */
  hint: number | null
  onDigit(digit: Digit): void
  onClear(): void
}

/** The keypad of the pick state: the digits 1 to 9 and Empty. The digit of the cell shows as the current key. */
export function CorrectionPad({ cell, look, hint, onDigit, onClear }: CorrectionPadProps) {
  // The keypad replaces the panel content, so each key says which cell it changes.
  const intl = useIntl()
  const accessibilityHint = intl.formatMessage({ id: 'scan.pad.hint' }, cellRowColumn(cell))
  return (
    <View testID="correction-pad" style={styles.pad}>
      {PAD_ROWS.map((digits, row) => (
        <View key={digits[0]} testID={`correction-pad-row-${row}`} style={styles.row}>
          {digits.map((digit) => {
            const current = look.digit === String(digit)
            return (
              <Pressable
                key={digit}
                testID={`correction-key-${digit}`}
                accessibilityRole="button"
                accessibilityLabel={intl.formatMessage({ id: 'scan.pad.set' }, { digit })}
                accessibilityHint={accessibilityHint}
                accessibilityState={{ selected: current }}
                onPress={() => onDigit(digit)}
                style={[styles.key, current && styles.keyCurrent]}
              >
                <Text style={[styles.keyText, current && styles.keyTextCurrent]}>{digit}</Text>
                {hint === digit && <View testID="correction-hint" pointerEvents="none" style={styles.hint} />}
              </Pressable>
            )
          })}
          {row === PAD_ROWS.length - 1 && (
            <Pressable
              testID="correction-clear"
              accessibilityRole="button"
              accessibilityLabel={intl.formatMessage({ id: 'scan.pad.emptyLabel' })}
              accessibilityHint={accessibilityHint}
              onPress={onClear}
              style={styles.key}
            >
              <Text style={styles.emptyText}>{intl.formatMessage({ id: 'scan.pad.empty' })}</Text>
              {hint === 0 && <View testID="correction-hint" pointerEvents="none" style={styles.hint} />}
            </Pressable>
          )}
        </View>
      ))}
    </View>
  )
}
