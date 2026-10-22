import { useRouter } from 'expo-router'
import { TechniquesScreen } from '@/techniques/screens/TechniquesScreen'

export default function TechniquesRoute() {
  const router = useRouter()
  return (
    <TechniquesScreen
      onBack={() => router.back()}
      onOpen={(technique) => router.push({ pathname: '/techniques/[technique]', params: { technique } })}
    />
  )
}
