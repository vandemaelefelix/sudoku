import { useLocalSearchParams, useRouter } from 'expo-router'
import { TechniqueScreen } from '@/techniques/screens/TechniqueScreen'
import { toTechniqueId } from '@/techniques/utils/techniques.utils'

export default function TechniqueRoute() {
  const router = useRouter()
  const { technique } = useLocalSearchParams<{ technique: string }>()
  return <TechniqueScreen technique={toTechniqueId(technique)} onBack={() => router.back()} />
}
