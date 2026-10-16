import Constants from 'expo-constants'
import { isDevelopmentVariant } from './appVariant.utils'

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: undefined } }))

const constants = Constants as unknown as { expoConfig: { extra?: { appVariant?: string } } | null | undefined }

it.each([
  [{ extra: { appVariant: 'development' } }, true],
  [{ extra: {} }, false],
  [{}, false],
  [null, false],
  [undefined, false],
])('reads %p as development: %p', (config, expected) => {
  constants.expoConfig = config
  expect(isDevelopmentVariant()).toBe(expected)
})
