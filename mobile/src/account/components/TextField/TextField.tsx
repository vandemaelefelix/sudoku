import { useEffect, type Ref } from 'react'
import { AccessibilityInfo, Text, TextInput, View, type ReturnKeyTypeOptions } from 'react-native'
import { withUnistyles } from 'react-native-unistyles'
import { FIELD_TRAITS, type FieldKind } from './TextField.constants'
import { styles } from './TextField.styles'

// The cursor, the selection and the placeholder colours are props, not styles, so Unistyles maps them from the theme.
const ThemedInput = withUnistyles(TextInput, (theme) => ({
  selectionColor: theme.colors.accent,
  cursorColor: theme.colors.accent,
  placeholderTextColor: theme.colors.textMuted,
}))

type TextFieldProps = {
  label: string
  kind: FieldKind
  value: string
  onChangeText(text: string): void
  error?: string | undefined
  returnKeyType?: ReturnKeyTypeOptions
  onSubmitEditing?: () => void
  inputRef?: Ref<TextInput>
}

/** A labelled text field. The error shows under it as the next element for VoiceOver, and a new error is announced. A hint would say it a third time. */
export function TextField({
  label,
  kind,
  value,
  onChangeText,
  error,
  returnKeyType,
  onSubmitEditing,
  inputRef,
}: TextFieldProps) {
  useEffect(() => {
    if (error !== undefined) AccessibilityInfo.announceForAccessibility(error)
  }, [error])
  return (
    <View style={styles.field}>
      <Text style={styles.label} accessibilityElementsHidden importantForAccessibility="no">
        {label}
      </Text>
      <ThemedInput
        ref={inputRef}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        submitBehavior={onSubmitEditing === undefined ? 'blurAndSubmit' : 'submit'}
        style={[styles.input, error !== undefined && styles.inputError]}
        {...FIELD_TRAITS[kind]}
      />
      {error === undefined ? null : <Text style={styles.error}>{error}</Text>}
    </View>
  )
}
