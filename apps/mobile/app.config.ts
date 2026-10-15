import type { ConfigContext, ExpoConfig } from 'expo/config'

export type AppVariant = 'development' | 'production'

const DEV_ICONS = './assets/icons/development'

// The development instance of Clerk (ADR-027). A publishable key is not a secret.
// The production variant gets the key of the production instance from PRODUCTION_BACKEND. Until then it has none.
export const DEVELOPMENT_CLERK_PUBLISHABLE_KEY = 'pk_test_ZnJlZS1sZW9wYXJkLTUyOTguY2xlcmsuYWNjb3VudHMuZGV2JA'

// The sync API of the development variant: the felix stage (ADR-027, ADR-028). The URL is public and grants no access.
// SYNC_API_URL overrides it at prebuild or start, to point a build at another stage. The production variant gets its URL from
// PRODUCTION_BACKEND once the production stage exists. Until then the production app does not sync.
export const DEVELOPMENT_SYNC_API_URL = 'https://hd381htgth.execute-api.eu-west-1.amazonaws.com'

const GOOGLE_CLIENT_SUFFIX = '.apps.googleusercontent.com'
const GOOGLE_IOS_CLIENT_ID = `579798513006-s2jpt2fc7ohah7kcu3s7jg968evv5s8n${GOOGLE_CLIENT_SUFFIX}`

/**
 * The public values of the development Clerk instance (ADR-027). They identify the app and grant no access.
 * The secret key never enters the app. Clerk reads the EXPO_PUBLIC_ names from `extra`: the hook at run time,
 * the Google plugin at prebuild. The URL scheme is the reversed iOS client ID, for the return from the Google sheet.
 */
const CLERK_DEVELOPMENT = {
  clerkPublishableKey: DEVELOPMENT_CLERK_PUBLISHABLE_KEY,
  EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID: GOOGLE_IOS_CLIENT_ID,
  EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID: `579798513006-h8h46s2ongqtrr412kkanflb7f6upjjk${GOOGLE_CLIENT_SUFFIX}`,
  EXPO_PUBLIC_CLERK_GOOGLE_IOS_URL_SCHEME: `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.replace(GOOGLE_CLIENT_SUFFIX, '')}`,
} as const

/**
 * The public values of the production Clerk instance and the production API (ADR-027, amendment "the production
 * release"). They are null until the instance and the stage exist. With a null key the production variant has no
 * account section and no sync, as before.
 */
export type ProductionBackend = {
  clerkPublishableKey: string | null
  syncApiUrl: string | null
  googleIosClientId: string | null
  googleWebClientId: string | null
}

export const PRODUCTION_BACKEND: ProductionBackend = {
  clerkPublishableKey: null,
  syncApiUrl: null,
  googleIosClientId: null,
  googleWebClientId: null,
}

function clerkProduction(backend: ProductionBackend, syncApiUrl: string | undefined) {
  const { googleIosClientId, googleWebClientId } = backend
  return {
    clerkPublishableKey: backend.clerkPublishableKey,
    ...(backend.syncApiUrl === null && !syncApiUrl ? {} : { syncApiUrl: syncApiUrl || backend.syncApiUrl }),
    ...(googleIosClientId === null
      ? {}
      : {
          EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID: googleIosClientId,
          EXPO_PUBLIC_CLERK_GOOGLE_IOS_URL_SCHEME: `com.googleusercontent.apps.${googleIosClientId.replace(GOOGLE_CLIENT_SUFFIX, '')}`,
        }),
    ...(googleWebClientId === null ? {} : { EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID: googleWebClientId }),
  }
}

/** ADR-022: an unset APP_VARIANT means development, so a plain `expo run:ios` never replaces the production app. */
export function appVariant(value: string | undefined): AppVariant {
  if (value === undefined || value === '' || value === 'development') return 'development'
  if (value === 'production') return 'production'
  throw new Error(`APP_VARIANT must be "development" or "production", not "${value}"`)
}

function required(value: string | undefined, key: string): string {
  if (value === undefined) throw new Error(`app.json has no ${key}`)
  return value
}

/** app.json is the production config. The development variant installs beside it (ADR-022). */
export function variantConfig(
  config: ExpoConfig,
  variant: AppVariant,
  syncApiUrl: string | undefined = process.env.SYNC_API_URL,
  production: ProductionBackend = PRODUCTION_BACKEND,
): ExpoConfig {
  if (variant === 'production') {
    // Without a key the production variant has no account UI, so the URL override has nothing to serve.
    if (production.clerkPublishableKey === null) return config
    return { ...config, extra: { ...config.extra, ...clerkProduction(production, syncApiUrl) } }
  }
  return {
    ...config,
    name: `${config.name} Dev`,
    scheme: 'sudoku-dev',
    // Read at run time by isDevelopmentVariant. The production config has no mark. It has a Clerk key only when PRODUCTION_BACKEND holds one (ADR-027).
    extra: {
      ...config.extra,
      appVariant: 'development',
      ...CLERK_DEVELOPMENT,
      syncApiUrl: syncApiUrl === undefined || syncApiUrl === '' ? DEVELOPMENT_SYNC_API_URL : syncApiUrl,
    },
    icon: `${DEV_ICONS}/ios-light.png`,
    ios: {
      ...config.ios,
      bundleIdentifier: `${required(config.ios?.bundleIdentifier, 'ios.bundleIdentifier')}.dev`,
      icon: {
        light: `${DEV_ICONS}/ios-light.png`,
        dark: `${DEV_ICONS}/ios-dark.png`,
        tinted: `${DEV_ICONS}/ios-tinted.png`,
      },
    },
    android: {
      ...config.android,
      package: `${required(config.android?.package, 'android.package')}.dev`,
      adaptiveIcon: {
        ...config.android?.adaptiveIcon,
        foregroundImage: `${DEV_ICONS}/android-foreground.png`,
        monochromeImage: `${DEV_ICONS}/android-monochrome.png`,
      },
    },
  }
}

// app.json always holds name and slug, so the config is a full ExpoConfig here.
export default ({ config }: ConfigContext): ExpoConfig =>
  variantConfig(config as ExpoConfig, appVariant(process.env.APP_VARIANT))
