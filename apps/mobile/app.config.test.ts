import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ExpoConfig } from 'expo/config'
import appJson from './app.json'
import { appVariant, variantConfig } from './app.config'

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

  it('stops when the base config has no bundle identifier', () => {
    const { ios: _ios, ...withoutIos } = base
    expect(() => variantConfig(withoutIos, 'development')).toThrow('bundleIdentifier')
  })
})
