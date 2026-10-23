import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Icon } from '@/components/Icon'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './CardRow.styles'

type CardRowProps = {
  label: string
  description?: string | undefined
  /** A control at the end of the row, for example a Toggle. The control then speaks for the row: VoiceOver skips the visible text. */
  trailing?: ReactNode
  /** An arrow at the end of the row, for a row that opens another screen. */
  chevron?: boolean
  /** A row with `onPress` is a button. A row without it only shows its content. */
  onPress?: (() => void) | undefined
  /** `danger` is for an action that deletes. `quiet` is for a value that the row only shows. */
  tone?: 'default' | 'danger' | 'quiet'
  disabled?: boolean
  /** What VoiceOver reads for the row. Without it, VoiceOver reads the visible text. */
  accessibilityLabel?: string
  accessibilityHint?: string
  testID?: string
}

/** One row of a FramedCard (ADR-026): a label, an optional description, and a control or an arrow at the end. */
export function CardRow({
  label,
  description,
  trailing,
  chevron = false,
  onPress,
  tone = 'default',
  disabled,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: CardRowProps) {
  const controlled = trailing !== undefined && onPress === undefined
  const content = (
    <>
      <View
        style={styles.text}
        accessibilityElementsHidden={controlled ? true : undefined}
        importantForAccessibility={controlled ? 'no-hide-descendants' : undefined}
      >
        <Text style={[styles.label, tone === 'danger' && styles.danger, tone === 'quiet' && styles.quiet]}>
          {label}
        </Text>
        {description !== undefined && <Text style={styles.description}>{description}</Text>}
      </View>
      {trailing}
      {chevron && <Icon name="next" tone="accent" size={16} />}
    </>
  )
  if (onPress === undefined) {
    return (
      <View
        testID={testID}
        style={styles.row}
        accessible={accessibilityLabel === undefined ? undefined : true}
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </View>
    )
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={disabled === undefined ? undefined : { disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && pressedStyles.pressed]}
    >
      {content}
    </Pressable>
  )
}
