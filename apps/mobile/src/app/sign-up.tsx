import { useRouter } from 'expo-router'
import { SignUpScreen } from '@/account/screens/SignUpScreen'

export default function SignUpRoute() {
  const router = useRouter()
  return (
    <SignUpScreen
      onDone={() => router.dismissTo('/settings')}
      onBack={() => router.back()}
      onSignIn={() => router.replace('/sign-in')}
    />
  )
}
