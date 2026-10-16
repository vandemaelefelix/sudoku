import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ExpoConfig } from 'expo/config'
import appJson from './app.json'
import { SPLASH_GROUND } from '@/theme/splash.colors'
import {
  appVariant,
  DEVELOPMENT_CLERK_PUBLISHABLE_KEY,
  DEVELOPMENT_SYNC_API_URL,
  PRODUCTION_BACKEND,
  variantConfig,
} from './app.config'

const base = appJson.expo as ExpoConfig

function imagePaths(config: ExpoConfig): string[] {
  const ios = config.ios?.icon
  const android = config.android?.adaptiveIcon
  const paths = [
    config.icon,
    typeof ios === 'string' ? ios : ios?.light,
    typeof ios === 'string' ? undefined : ios?.dark,
    typeof ios === 'string' ? undefined : ios?.tinted,
    android?.foregroundImage,
    android?.backgroundImage,
    android?.monochromeImage,
    config.web?.favicon,
  ]
  return paths.filter((path): path is string => path !== undefined)
}

describe('appVariant', () => {
  it('reads an unset or empty variable as development', () => {
    expect(appVariant(undefined)).toBe('development')
    expect(appVariant('')).toBe('development')
  })

  it('accepts the two variant names', () => {
    expect(appVariant('development')).toBe('development')
    expect(appVariant('production')).toBe('production')
  })

  it('stops on an unknown name', () => {
    expect(() => appVariant('prod')).toThrow('APP_VARIANT')
  })
})

describe('the sync API URL', () => {
  it('gives the development variant the committed URL', () => {
    expect(variantConfig(base, 'development', undefined).extra?.syncApiUrl).toBe(DEVELOPMENT_SYNC_API_URL)
    expect(variantConfig(base, 'development', '').extra?.syncApiUrl).toBe(DEVELOPMENT_SYNC_API_URL)
  })

  it('lets SYNC_API_URL override it', () => {
    expect(variantConfig(base, 'development', 'https://other.example.com').extra?.syncApiUrl).toBe(
      'https://other.example.com',
    )
  })

  it('gives the production variant no URL while it has no key, also with the override', () => {
    const none = { ...PRODUCTION_BACKEND, clerkPublishableKey: null }
    expect(variantConfig(base, 'production', 'https://other.example.com', none).extra?.syncApiUrl).toBeUndefined()
  })
})

describe('the production backend', () => {
  const live = {
    clerkPublishableKey: 'pk_live_Y2xlcmsuc3Vkb2t1LmV4YW1wbGUuY29tJA',
    syncApiUrl: 'https://prod.example.com',
    googleIosClientId: '123-ios.apps.googleusercontent.com',
    googleWebClientId: '123-web.apps.googleusercontent.com',
  }

  it('holds the production Clerk values and the production sync URL', () => {
    expect(PRODUCTION_BACKEND).toEqual({
      clerkPublishableKey: 'pk_live_Y2xlcmsuc3Vkb2t1LmZlbGl4dmFuZGVtYWVsZS5iZSQ',
      syncApiUrl: 'https://dfdhsxd374.execute-api.eu-west-1.amazonaws.com',
      googleIosClientId: '579798513006-3j8bts21f938o7pp100nv0tujpjfer7i.apps.googleusercontent.com',
      googleWebClientId: '579798513006-n4jlbj4c7tsa4987btou7ilp4jf7ro62.apps.googleusercontent.com',
    })
  })

  it('gives the production key the live prefix and the host of the production issuer (backend/infra/config.ts)', () => {
    const key = PRODUCTION_BACKEND.clerkPublishableKey as string
    expect(key).toMatch(/^pk_live_/)
    const host = Buffer.from(key.slice('pk_live_'.length), 'base64').toString()
    expect(host).toBe('clerk.sudoku.felixvandemaele.be$')
  })

  it('gives the production variant the key, both Google IDs and the reversed URL scheme, and the production sync URL', () => {
    const extra = variantConfig(base, 'production', undefined, PRODUCTION_BACKEND).extra
    expect(extra).toMatchObject({
      clerkPublishableKey: PRODUCTION_BACKEND.clerkPublishableKey,
      EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID: PRODUCTION_BACKEND.googleIosClientId,
      EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID: PRODUCTION_BACKEND.googleWebClientId,
      EXPO_PUBLIC_CLERK_GOOGLE_IOS_URL_SCHEME:
        'com.googleusercontent.apps.579798513006-3j8bts21f938o7pp100nv0tujpjfer7i',
    })
    expect(extra?.syncApiUrl).toBe('https://dfdhsxd374.execute-api.eu-west-1.amazonaws.com')
  })

  it('production without a key has no clerk extra', () => {
    const none = { ...PRODUCTION_BACKEND, clerkPublishableKey: null }
    expect(variantConfig(base, 'production', undefined, none)).toBe(base)
  })

  it('production with a key has the key, the URL and the Google IDs', () => {
    const extra = variantConfig(base, 'production', undefined, live).extra
    expect(extra).toMatchObject({
      clerkPublishableKey: live.clerkPublishableKey,
      syncApiUrl: live.syncApiUrl,
      EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID: live.googleIosClientId,
      EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID: live.googleWebClientId,
      EXPO_PUBLIC_CLERK_GOOGLE_IOS_URL_SCHEME: 'com.googleusercontent.apps.123-ios',
    })
    expect(extra?.appVariant).toBeUndefined()
  })

  it('lets SYNC_API_URL override the production URL', () => {
    expect(variantConfig(base, 'production', 'https://other.example.com', live).extra?.syncApiUrl).toBe(
      'https://other.example.com',
    )
  })

  it('keeps the production name and bundle identifier', () => {
    const prod = variantConfig(base, 'production', undefined, live)
    expect(prod.name).toBe('Sudoku')
    expect(prod.ios?.bundleIdentifier).toBe('com.vandemaelefelix.sudoku')
  })
})

describe('variantConfig', () => {
  it('keeps the production name, icons and identifiers', () => {
    const prod = variantConfig(base, 'production')
    expect({ ...prod, extra: undefined }).toEqual({ ...base, extra: undefined })
  })

  it('gives the development variant its own name, IDs and scheme', () => {
    const dev = variantConfig(base, 'development')
    expect(dev.name).toBe('Sudoku Dev')
    expect(dev.scheme).toBe('sudoku-dev')
    expect(variantConfig(base, 'production').scheme).not.toBe(dev.scheme)
    expect(dev.ios?.bundleIdentifier).toBe('com.vandemaelefelix.sudoku.dev')
    expect(dev.android?.package).toBe('com.vandemaelefelix.sudoku.dev')
  })

  it('tells the app that it is the development variant, and leaves the production config without a mark', () => {
    expect(variantConfig(base, 'development').extra).toMatchObject({ appVariant: 'development' })
    expect(variantConfig(base, 'production').extra?.appVariant).toBeUndefined()
  })

  it('gives each variant the publishable key of its own Clerk instance (ADR-027)', () => {
    const key = variantConfig(base, 'development').extra?.clerkPublishableKey as string
    expect(key).toBe(DEVELOPMENT_CLERK_PUBLISHABLE_KEY)
    expect(key).toMatch(/^pk_test_/)
    // A publishable key is the base64 of the Frontend API host with a `$` at the end.
    const host = Buffer.from(key.slice('pk_test_'.length), 'base64').toString()
    expect(host).toMatch(/^[a-z0-9-]+\.clerk\.accounts\.dev\$$/)
    expect(variantConfig(base, 'production').extra?.clerkPublishableKey).toBe(PRODUCTION_BACKEND.clerkPublishableKey)
  })

  it('uses the ribbon icons in development, except the shared Android background', () => {
    const dev = variantConfig(base, 'development')
    const paths = imagePaths(dev)
    expect(paths.filter((path) => path.includes('/production/'))).toEqual([
      './assets/icons/production/android-background.png',
    ])
  })

  it('points every image of both variants at a file that exists', () => {
    for (const variant of ['production', 'development'] as const) {
      for (const path of imagePaths(variantConfig(base, variant))) {
        expect({ path, exists: existsSync(join(__dirname, path)) }).toEqual({ path, exists: true })
      }
    }
  })

  it('gives the native splash only a white ground, the same in light and dark mode, like the splash overlay', () => {
    type SplashOptions = { backgroundColor?: string; image?: string; dark?: unknown }
    const entry = (base.plugins ?? []).find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')
    const options = (entry as [string, SplashOptions] | undefined)?.[1]
    expect(options?.backgroundColor).toBe(SPLASH_GROUND)
    expect(options?.image).toBeUndefined()
    expect(options?.dark).toBeUndefined()
  })

  it('follows the iOS appearance, so the Auto appearance can read it (ADR-026)', () => {
    expect(base.userInterfaceStyle).toBe('automatic')
    expect(variantConfig(base, 'development').userInterfaceStyle).toBe('automatic')
  })

  it('gives the development variant the public Google client IDs, and production its own', () => {
    const extra = variantConfig(base, 'development').extra
    expect(extra?.EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID).toMatch(/\.apps\.googleusercontent\.com$/)
    expect(extra?.EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID).toMatch(/\.apps\.googleusercontent\.com$/)
    expect(variantConfig(base, 'production').extra?.EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID).not.toBe(
      extra?.EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID,
    )
  })

  it('registers the reversed iOS client ID as the URL scheme that the Google sheet returns to', () => {
    const extra = variantConfig(base, 'development').extra
    const clientId = String(extra?.EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID).replace('.apps.googleusercontent.com', '')
    expect(extra?.EXPO_PUBLIC_CLERK_GOOGLE_IOS_URL_SCHEME).toBe(`com.googleusercontent.apps.${clientId}`)
  })

  it('lists the Clerk plugins, so the native sign-in modules and the iOS 17 target come with a prebuild', () => {
    const names = (base.plugins ?? []).map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin))
    expect(names).toEqual(expect.arrayContaining(['@clerk/expo', '@clerk/expo-google-signin']))
  })

  it('leaves out the Sign in with Apple entitlement: ADR-027 has no Apple sign-in and a free Apple team cannot sign it', () => {
    const entry = (base.plugins ?? []).find((plugin) => Array.isArray(plugin) && plugin[0] === '@clerk/expo')
    expect((entry as [string, { appleSignIn?: boolean }] | undefined)?.[1]).toEqual({ appleSignIn: false })
  })

  it('stops when the base config has no bundle identifier', () => {
    const { ios: _ios, ...withoutIos } = base
    expect(() => variantConfig(withoutIos, 'development')).toThrow('bundleIdentifier')
  })
})
