import { useState } from 'react'
import { View } from 'react-native'
import { AuthButton } from '@/account/components/AuthButton'
import { FormMessage } from '@/account/components/FormMessage'
import { TextField } from '@/account/components/TextField'
import type { AuthErrors } from '@/account/utils/authErrors.utils'
import { useIntl } from '@/i18n/hooks/useIntl'
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
  const intl = useIntl()
  const verify = () => onVerify(code.trim())
  return (
    <View style={styles.step}>
      <FormMessage tone="muted" message={intl.formatMessage({ id: 'account.code.sent' }, { email })} />
      <TextField
        label={intl.formatMessage({ id: 'account.field.code' })}
        kind="code"
        value={code}
        onChangeText={setCode}
        error={errors.code && intl.formatMessage({ id: errors.code })}
        returnKeyType="go"
        onSubmitEditing={verify}
      />
      <FormMessage tone="danger" message={errors.form && intl.formatMessage({ id: errors.form })} />
      <View style={styles.actions}>
        <AuthButton
          label={intl.formatMessage({ id: 'account.code.verify' })}
          kind="primary"
          busy={busy}
          onPress={verify}
        />
        <AuthButton
          label={intl.formatMessage({ id: 'account.code.resend' })}
          kind="outline"
          disabled={busy}
          onPress={onResend}
        />
        <AuthButton
          label={intl.formatMessage({ id: 'account.code.otherEmail' })}
          kind="outline"
          disabled={busy}
          onPress={onEdit}
        />
      </View>
    </View>
  )
}
