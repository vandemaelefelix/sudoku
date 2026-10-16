import { useRef, useState } from 'react'
import { View, type TextInput } from 'react-native'
import { AuthButton } from '@/account/components/AuthButton'
import { AuthLayout } from '@/account/components/AuthLayout'
import { CodeStep } from '@/account/components/CodeStep'
import { FormMessage } from '@/account/components/FormMessage'
import { GoogleButton } from '@/account/components/GoogleButton'
import { TextField } from '@/account/components/TextField'
import { UNCONFIGURED_MESSAGE } from '@/account/constants/account.constants'
import { useAccount } from '@/account/hooks/useAccount'
import { useEmailSignIn } from '@/account/hooks/useEmailSignIn'
import { useGoogleSignIn } from '@/account/hooks/useGoogleSignIn'
import { styles } from './SignInScreen.styles'

type SignInScreenProps = { onDone(): void; onBack(): void; onSignUp(): void }

const TITLE = 'Sign in'

/** Sign in with email and password. On a new device Clerk asks for an email code first. */
export function SignInScreen(props: SignInScreenProps) {
  const { status } = useAccount()
  if (status === 'unconfigured')
    return (
      <AuthLayout title={TITLE} onBack={props.onBack}>
        <FormMessage tone="muted" message={UNCONFIGURED_MESSAGE} />
      </AuthLayout>
    )
  return <SignInForm {...props} />
}

function SignInForm({ onDone, onBack, onSignUp }: SignInScreenProps) {
  const { step, busy, errors, submit, verifyCode, resendCode, restart } = useEmailSignIn(onDone)
  const google = useGoogleSignIn(onDone)
  const waiting = busy || google.busy
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const passwordRef = useRef<TextInput>(null)
  const signIn = () => submit(email.trim(), password)
  if (step === 'code')
    return (
      <AuthLayout title={TITLE} onBack={onBack}>
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
    <AuthLayout title={TITLE} onBack={onBack}>
      <View style={styles.form}>
        {step === 'unsupported' ? (
          <FormMessage
            tone="danger"
            message="This account uses two-step verification. The app does not support it yet."
          />
        ) : null}
        <TextField
          label="Email"
          kind="email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          inputRef={passwordRef}
          label="Password"
          kind="password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          returnKeyType="go"
          onSubmitEditing={signIn}
        />
        <FormMessage tone="danger" message={errors.form ?? google.error} />
        <View style={styles.actions}>
          <AuthButton label="Sign in" kind="primary" busy={busy} disabled={google.busy} onPress={signIn} />
          <GoogleButton busy={google.busy} disabled={busy} onPress={google.signIn} />
          <AuthButton label="Create an account" kind="outline" disabled={waiting} onPress={onSignUp} />
        </View>
      </View>
    </AuthLayout>
  )
}
