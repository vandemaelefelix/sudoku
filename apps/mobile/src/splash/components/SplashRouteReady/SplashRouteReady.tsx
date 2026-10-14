import { usePathname } from 'expo-router'
import { useSplashReady } from '@/splash/hooks/useSplash'

/** The home menu tells the splash when it is ready. A link can open another screen first, and that screen has no such signal. */
export function SplashRouteReady() {
  useSplashReady(usePathname() !== '/')
  return null
}
