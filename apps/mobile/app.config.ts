import type { ConfigContext, ExpoConfig } from 'expo/config'

export type AppVariant = 'development' | 'production'

const DEV_ICONS = './assets/icons/development'

// The development instance of Clerk (ADR-027). A publishable key is not a secret.
// The production variant gets the key of the production instance in app.json. Until then it has none.
export const DEVELOPMENT_CLERK_PUBLISHABLE_KEY = 'pk_test_ZnJlZS1sZW9wYXJkLTUyOTguY2xlcmsuYWNjb3VudHMuZGV2JA'

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
export function variantConfig(config: ExpoConfig, variant: AppVariant): ExpoConfig {
  if (variant === 'production') return config
  return {
    ...config,
    name: `${config.name} Dev`,
    scheme: 'sudoku-dev',
    // Read at run time by isDevelopmentVariant. The production config has no mark and no Clerk key: the production instance comes later (ADR-027).
    extra: { ...config.extra, appVariant: 'development', ...CLERK_DEVELOPMENT },
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
