import { useState } from 'react'
import { View } from 'react-native'
import { AuthButton } from '@/account/components/AuthButton'
import { FormMessage } from '@/account/components/FormMessage'
import { TextField } from '@/account/components/TextField'
import type { AuthErrors } from '@/account/utils/authErrors.utils'
import { styles } from './CodeStep.styles'

type CodeStepProps = {
  email: string
  busy: boolean
  errors: AuthErrors
  onVerify(code: string): void
  onResend(): void
  /** Back to the email and the password, for a typo in the email. */
  onEdit(): void
}

/** The step for the 6-digit email code. iOS offers the code from Mail above the keyboard. */
export function CodeStep({ email, busy, errors, onVerify, onResend, onEdit }: CodeStepProps) {
  const [code, setCode] = useState('')
  const verify = () => onVerify(code.trim())
  return (
    <View style={styles.step}>
      <FormMessage tone="muted" message={`We sent a code to ${email}.`} />
      <TextField
        label="Code"
        kind="code"
        value={code}
        onChangeText={setCode}
        error={errors.code}
        returnKeyType="go"
        onSubmitEditing={verify}
      />
      <FormMessage tone="danger" message={errors.form} />
      <View style={styles.actions}>
        <AuthButton label="Verify" kind="primary" busy={busy} onPress={verify} />
        <AuthButton label="Send the code again" kind="outline" disabled={busy} onPress={onResend} />
        <AuthButton label="Use another email" kind="outline" disabled={busy} onPress={onEdit} />
      </View>
    </View>
  )
}
