import { useRouter } from 'expo-router'
import { SignInScreen } from '@/account/screens/SignInScreen'

export default function SignInRoute() {
  const router = useRouter()
  return (
    <SignInScreen
      onDone={() => router.dismissTo('/settings')}
      onBack={() => router.back()}
      onSignUp={() => router.replace('/sign-up')}
    />
  )
}
