import { useRef, useState } from 'react'
import { View, type TextInput } from 'react-native'
import { AuthButton } from '@/account/components/AuthButton'
import { AuthLayout } from '@/account/components/AuthLayout'
import { CodeStep } from '@/account/components/CodeStep'
import { FormMessage } from '@/account/components/FormMessage'
import { GoogleButton } from '@/account/components/GoogleButton'
import { TextField } from '@/account/components/TextField'
import { useAccount } from '@/account/hooks/useAccount'
import { useEmailSignIn } from '@/account/hooks/useEmailSignIn'
import { useGoogleSignIn } from '@/account/hooks/useGoogleSignIn'
import { useIntl } from '@/i18n/hooks/useIntl'
import type { MessageId } from '@/i18n/messages'
import { styles } from './SignInScreen.styles'

type SignInScreenProps = { onDone(): void; onBack(): void; onSignUp(): void }

/** Sign in with email and password. On a new device Clerk asks for an email code first. */
export function SignInScreen(props: SignInScreenProps) {
  const { status } = useAccount()
  const intl = useIntl()
  if (status === 'unconfigured')
    return (
      <AuthLayout title={intl.formatMessage({ id: 'account.signIn.title' })} onBack={props.onBack}>
        <FormMessage tone="muted" message={intl.formatMessage({ id: 'account.unconfigured' })} />
      </AuthLayout>
    )
  return <SignInForm {...props} />
}

function SignInForm({ onDone, onBack, onSignUp }: SignInScreenProps) {
  const { step, busy, errors, submit, verifyCode, resendCode, restart } = useEmailSignIn(onDone)
  const google = useGoogleSignIn(onDone)
  const intl = useIntl()
  const title = intl.formatMessage({ id: 'account.signIn.title' })
  const errorText = (id: MessageId | undefined) => (id === undefined ? undefined : intl.formatMessage({ id }))
  const waiting = busy || google.busy
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const passwordRef = useRef<TextInput>(null)
  const signIn = () => submit(email.trim(), password)
  if (step === 'code')
    return (
      <AuthLayout title={title} onBack={onBack}>
        <CodeStep
          email={email.trim()}
          busy={busy}
          errors={errors}
          onVerify={verifyCode}
          onResend={resendCode}
          onEdit={restart}
        />
      </AuthLayout>
    )
  return (
    <AuthLayout title={title} onBack={onBack}>
      <View style={styles.form}>
        {step === 'unsupported' ? (
          <FormMessage tone="danger" message={intl.formatMessage({ id: 'account.signIn.twoStep' })} />
        ) : null}
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
          kind="password"
          value={password}
          onChangeText={setPassword}
          error={errorText(errors.password)}
          returnKeyType="go"
          onSubmitEditing={signIn}
        />
        <FormMessage tone="danger" message={errorText(errors.form ?? google.error)} />
        <View style={styles.actions}>
          <AuthButton
            label={intl.formatMessage({ id: 'account.signIn.submit' })}
            kind="primary"
            busy={busy}
            disabled={google.busy}
            onPress={signIn}
          />
          <GoogleButton busy={google.busy} disabled={busy} onPress={google.signIn} />
          <AuthButton
            label={intl.formatMessage({ id: 'account.signIn.toSignUp' })}
            kind="outline"
            disabled={waiting}
            onPress={onSignUp}
          />
        </View>
      </View>
    </AuthLayout>
  )
}
