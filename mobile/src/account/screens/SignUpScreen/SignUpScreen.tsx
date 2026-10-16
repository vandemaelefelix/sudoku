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
import { useEmailSignUp } from '@/account/hooks/useEmailSignUp'
import { useGoogleSignIn } from '@/account/hooks/useGoogleSignIn'
import { styles } from './SignUpScreen.styles'

type SignUpScreenProps = { onDone(): void; onBack(): void; onSignIn(): void }

const TITLE = 'Create an account'

/** Sign up with email and password, then the email code proves the email. */
export function SignUpScreen(props: SignUpScreenProps) {
  const { status } = useAccount()
  if (status === 'unconfigured')
    return (
      <AuthLayout title={TITLE} onBack={props.onBack}>
        <FormMessage tone="muted" message={UNCONFIGURED_MESSAGE} />
      </AuthLayout>
    )
  return <SignUpForm {...props} />
}

function SignUpForm({ onDone, onBack, onSignIn }: SignUpScreenProps) {
  const { step, busy, errors, submit, verifyCode, resendCode, editDetails } = useEmailSignUp(onDone)
  const google = useGoogleSignIn(onDone)
  const waiting = busy || google.busy
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const passwordRef = useRef<TextInput>(null)
  const create = () => submit(email.trim(), password)
  if (step === 'code')
    return (
      <AuthLayout title={TITLE} onBack={onBack}>
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
    <AuthLayout title={TITLE} onBack={onBack}>
      <View style={styles.form}>
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
          kind="newPassword"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          returnKeyType="go"
          onSubmitEditing={create}
        />
        <FormMessage tone="danger" message={errors.form ?? google.error} />
        <View style={styles.actions}>
          <AuthButton label="Create account" kind="primary" busy={busy} disabled={google.busy} onPress={create} />
          <GoogleButton busy={google.busy} disabled={busy} onPress={google.signIn} />
          <AuthButton label="I have an account" kind="outline" disabled={waiting} onPress={onSignIn} />
        </View>
      </View>
    </AuthLayout>
  )
}
