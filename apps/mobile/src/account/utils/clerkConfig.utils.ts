import Constants from 'expo-constants'

/** The Clerk publishable key in the `extra` of the app config, or null when the variant has none (ADR-027). */
export function publishableKeyOf(extra: Record<string, unknown> | undefined): string | null {
  const key = extra?.clerkPublishableKey
  return typeof key === 'string' && key !== '' ? key : null
}

/** app.config.ts gives the production variant a key only when PRODUCTION_BACKEND holds one. Until then it has no account. */
export function readPublishableKey(): string | null {
  return publishableKeyOf(Constants.expoConfig?.extra)
}
