import { useRouter } from 'expo-router'
import { StatsScreen } from '@/stats/screens/StatsScreen'

export default function StatsRoute() {
  const router = useRouter()
  return <StatsScreen onBack={() => router.back()} />
}
