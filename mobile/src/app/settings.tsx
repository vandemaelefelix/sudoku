import { useRouter } from 'expo-router'
import { SettingsScreen } from '@/settings/screens/SettingsScreen'

export default function SettingsRoute() {
  const router = useRouter()
  return (
    <SettingsScreen
      onBack={() => router.back()}
      onSignIn={() => router.push('/sign-in')}
      onTechniques={() => router.push('/techniques')}
    />
  )
}
