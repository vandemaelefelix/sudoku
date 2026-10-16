import Constants from 'expo-constants'

/** True in the development variant of the app (ADR-022). app.config.ts marks only that variant. */
export function isDevelopmentVariant(): boolean {
  return Constants.expoConfig?.extra?.appVariant === 'development'
}
