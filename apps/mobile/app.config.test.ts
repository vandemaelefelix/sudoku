import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ExpoConfig } from 'expo/config'
import appJson from './app.json'
import { SPLASH_GROUND } from '@/theme/splash.colors'
import { appVariant, DEVELOPMENT_CLERK_PUBLISHABLE_KEY, variantConfig } from './app.config'

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

describe('variantConfig', () => {
  it('keeps the production config unchanged', () => {
    expect(variantConfig(base, 'production')).toBe(base)
  })

  it('gives the development variant its own name, IDs and scheme', () => {
    const dev = variantConfig(base, 'development')
    expect(dev.name).toBe('Sudoku Dev')
    expect(dev.scheme).toBe('sudoku-dev')
    expect(dev.ios?.bundleIdentifier).toBe('com.vandemaelefelix.sudoku.dev')
    expect(dev.android?.package).toBe('com.vandemaelefelix.sudoku.dev')
  })

  it('tells the app that it is the development variant, and leaves the production config without a mark', () => {
    expect(variantConfig(base, 'development').extra).toMatchObject({ appVariant: 'development' })
    expect(variantConfig(base, 'production').extra?.appVariant).toBeUndefined()
  })

  it('gives only the development variant the publishable key of the Clerk development instance (ADR-027)', () => {
    const key = variantConfig(base, 'development').extra?.clerkPublishableKey as string
    expect(key).toBe(DEVELOPMENT_CLERK_PUBLISHABLE_KEY)
    expect(key).toMatch(/^pk_test_/)
    // A publishable key is the base64 of the Frontend API host with a `$` at the end.
    const host = Buffer.from(key.slice('pk_test_'.length), 'base64').toString()
    expect(host).toMatch(/^[a-z0-9-]+\.clerk\.accounts\.dev\$$/)
    expect(variantConfig(base, 'production').extra?.clerkPublishableKey).toBeUndefined()
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

  it('gives the development variant the public Google client IDs, and production none', () => {
    const extra = variantConfig(base, 'development').extra
    expect(extra?.EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID).toMatch(/\.apps\.googleusercontent\.com$/)
    expect(extra?.EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID).toMatch(/\.apps\.googleusercontent\.com$/)
    expect(variantConfig(base, 'production').extra?.EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID).toBeUndefined()
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
