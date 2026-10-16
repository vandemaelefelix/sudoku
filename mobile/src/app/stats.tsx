import { useRouter } from 'expo-router'
import { StatsScreen } from '@/stats/screens/StatsScreen'
import { SyncedLine } from '@/sync/components/SyncedLine'
import { useSync } from '@/sync/hooks/useSync'

export default function StatsRoute() {
  const router = useRouter()
  const { revision } = useSync()
  return <StatsScreen onBack={() => router.back()} footer={<SyncedLine />} refreshKey={revision} />
}
