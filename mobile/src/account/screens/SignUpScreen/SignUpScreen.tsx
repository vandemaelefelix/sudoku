import { useRef, useState } from 'react'
import { View, type TextInput } from 'react-native'
import { AuthButton } from '@/account/components/AuthButton'
import { AuthLayout } from '@/account/components/AuthLayout'
import { CodeStep } from '@/account/components/CodeStep'
import { FormMessage } from '@/account/components/FormMessage'
import { GoogleButton } from '@/account/components/GoogleButton'
import { TextField } from '@/account/components/TextField'
import { useAccount } from '@/account/hooks/useAccount'
import { useEmailSignUp } from '@/account/hooks/useEmailSignUp'
import { useGoogleSignIn } from '@/account/hooks/useGoogleSignIn'
import { useIntl } from '@/i18n/hooks/useIntl'
import type { MessageId } from '@/i18n/messages'
import { styles } from './SignUpScreen.styles'

type SignUpScreenProps = { onDone(): void; onBack(): void; onSignIn(): void }

/** Sign up with email and password, then the email code proves the email. */
export function SignUpScreen(props: SignUpScreenProps) {
  const { status } = useAccount()
  const intl = useIntl()
  if (status === 'unconfigured')
    return (
      <AuthLayout title={intl.formatMessage({ id: 'account.signUp.title' })} onBack={props.onBack}>
        <FormMessage tone="muted" message={intl.formatMessage({ id: 'account.unconfigured' })} />
      </AuthLayout>
    )
  return <SignUpForm {...props} />
}

function SignUpForm({ onDone, onBack, onSignIn }: SignUpScreenProps) {
  const { step, busy, errors, submit, verifyCode, resendCode, editDetails } = useEmailSignUp(onDone)
  const google = useGoogleSignIn(onDone)
  const intl = useIntl()
  const title = intl.formatMessage({ id: 'account.signUp.title' })
  const errorText = (id: MessageId | undefined) => (id === undefined ? undefined : intl.formatMessage({ id }))
  const waiting = busy || google.busy
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const passwordRef = useRef<TextInput>(null)
  const create = () => submit(email.trim(), password)
  if (step === 'code')
    return (
      <AuthLayout title={title} onBack={onBack}>
        <CodeStep
          email={email.trim()}
          busy={busy}
          errors={errors}
          onVerify={verifyCode}
          onResend={resendCode}
          onEdit={editDetails}
        />
      </AuthLayout>
    )
  return (
    <AuthLayout title={title} onBack={onBack}>
      <View style={styles.form}>
        <TextField
          label={intl.formatMessage({ id: 'account.field.email' })}
          kind="email"
          value={email}
          onChangeText={setEmail}
          error={errorText(errors.email)}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          inputRef={passwordRef}
          label={intl.formatMessage({ id: 'account.field.password' })}
          kind="newPassword"
          value={password}
          onChangeText={setPassword}
          error={errorText(errors.password)}
          returnKeyType="go"
          onSubmitEditing={create}
        />
        <FormMessage tone="danger" message={errorText(errors.form ?? google.error)} />
        <View style={styles.actions}>
          <AuthButton
            label={intl.formatMessage({ id: 'account.signUp.submit' })}
            kind="primary"
            busy={busy}
            disabled={google.busy}
            onPress={create}
          />
          <GoogleButton busy={google.busy} disabled={busy} onPress={google.signIn} />
          <AuthButton
            label={intl.formatMessage({ id: 'account.signUp.toSignIn' })}
            kind="outline"
            disabled={waiting}
            onPress={onSignIn}
          />
        </View>
      </View>
    </AuthLayout>
  )
}
