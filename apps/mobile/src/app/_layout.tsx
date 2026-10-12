import { Stack } from 'expo-router'
import { GameStorageProvider } from '@/storage/components/GameStorageProvider'

/** Each screen draws its own themed header and background, so the stack shows no native header (ADR-016). */
export default function RootLayout() {
  return (
    <GameStorageProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </GameStorageProvider>
  )
}
