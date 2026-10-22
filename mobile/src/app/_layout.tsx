import { Stack } from 'expo-router'
import { AccountProvider } from '@/account/components/AccountProvider'
import { ScanShareDrainer } from '@/scanShare/components/ScanShareDrainer'
import { ScanShareNotice } from '@/scanShare/components/ScanShareNotice'
import { SplashOverlay } from '@/splash/components/SplashOverlay'
import { SplashProvider } from '@/splash/components/SplashProvider'
import { SplashRouteReady } from '@/splash/components/SplashRouteReady'
import { GameStorageProvider } from '@/storage/components/GameStorageProvider'
import { SyncProvider } from '@/sync/components/SyncProvider'
import { ScreenShowLayout } from '@/theme/decorations/ScreenShow'
import { SystemAppearanceFollower } from '@/theme/system'
import { ThemeTransitionProvider } from '@/theme/transition'

/**
 * Each screen draws its own themed header and background, so the stack shows no native header (ADR-016).
 * The theme cell wave is inside the splash and over the screens, so a theme switch draws over every screen (ADR-025).
 * The splash overlay is outside the storage provider: it draws at once, before the storage opens (ADR-024).
 * The account gives the owner of the games to every route (ADR-028). It never waits for Clerk.
 * The scan drainer sends the waiting scans (ADR-030). It needs the account for the token.
 * The sync provider is inside the storage provider. It renders the routes at once and syncs in the background.
 * Each screen gets its own events, so its Skia surfaces draw again when it shows again (ADR-025).
 */
export default function RootLayout() {
  return (
    <SplashProvider>
      <ThemeTransitionProvider>
        <SystemAppearanceFollower />
        <AccountProvider>
          <GameStorageProvider>
            <SyncProvider>
              <ScanShareDrainer />
              <ScanShareNotice />
              <SplashRouteReady />
              <Stack screenOptions={{ headerShown: false }} screenLayout={ScreenShowLayout} />
            </SyncProvider>
          </GameStorageProvider>
        </AccountProvider>
      </ThemeTransitionProvider>
      <SplashOverlay />
    </SplashProvider>
  )
}
