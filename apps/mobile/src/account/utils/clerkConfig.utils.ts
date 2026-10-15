import Constants from 'expo-constants'

/** The Clerk publishable key in the `extra` of the app config, or null when the variant has none (ADR-027). */
export function publishableKeyOf(extra: Record<string, unknown> | undefined): string | null {
  const key = extra?.clerkPublishableKey
  return typeof key === 'string' && key !== '' ? key : null
}

/** app.config.ts gives a key only to the development variant, so the production app has no account yet. */
export function readPublishableKey(): string | null {
  return publishableKeyOf(Constants.expoConfig?.extra)
}
