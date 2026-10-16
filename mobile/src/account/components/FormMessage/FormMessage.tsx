import { useEffect } from 'react'
import { AccessibilityInfo, Text } from 'react-native'
import { styles } from './FormMessage.styles'

type FormMessageProps = {
  message: string | undefined
  /** danger: an error that stops the flow. muted: a note, such as where the code went. */
  tone: 'danger' | 'muted'
}

/** A line of text above the button of a form. A new error is announced to VoiceOver. */
export function FormMessage({ message, tone }: FormMessageProps) {
  useEffect(() => {
    if (message !== undefined && tone === 'danger') AccessibilityInfo.announceForAccessibility(message)
  }, [message, tone])
  if (message === undefined) return null
  return <Text style={tone === 'danger' ? styles.danger : styles.muted}>{message}</Text>
}
