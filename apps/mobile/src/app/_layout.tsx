import { Stack } from 'expo-router'
import { SplashOverlay } from '@/splash/components/SplashOverlay'
import { SplashProvider } from '@/splash/components/SplashProvider'
import { SplashRouteReady } from '@/splash/components/SplashRouteReady'
import { GameStorageProvider } from '@/storage/components/GameStorageProvider'

/**
 * Each screen draws its own themed header and background, so the stack shows no native header (ADR-016).
 * The splash overlay is outside the storage provider: it draws at once, before the storage opens (ADR-024).
 */
export default function RootLayout() {
  return (
    <SplashProvider>
      <GameStorageProvider>
        <SplashRouteReady />
        <Stack screenOptions={{ headerShown: false }} />
      </GameStorageProvider>
      <SplashOverlay />
    </SplashProvider>
  )
}
