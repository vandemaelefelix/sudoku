import type { ConfigContext, ExpoConfig } from 'expo/config'

export type AppVariant = 'development' | 'production'

const DEV_ICONS = './assets/icons/development'

// The development instance of Clerk (ADR-027). A publishable key is not a secret.
// The production variant gets the key of the production instance in app.json. Until then it has none.
export const DEVELOPMENT_CLERK_PUBLISHABLE_KEY = 'pk_test_ZnJlZS1sZW9wYXJkLTUyOTguY2xlcmsuYWNjb3VudHMuZGV2JA'

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
    // Read at run time by isDevelopmentVariant. The production config has no mark.
    extra: { ...config.extra, appVariant: 'development', clerkPublishableKey: DEVELOPMENT_CLERK_PUBLISHABLE_KEY },
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
