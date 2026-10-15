import Constants from 'expo-constants'
import { readSyncApiUrl, syncApiUrlOf } from './syncConfig.utils'

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: undefined } }))

const constants = Constants as unknown as { expoConfig: { extra?: Record<string, unknown> } | null | undefined }

it.each([
  [
    { syncApiUrl: 'https://abc.execute-api.eu-west-1.amazonaws.com' },
    'https://abc.execute-api.eu-west-1.amazonaws.com',
  ],
  [{ syncApiUrl: 'https://abc.example.com/' }, 'https://abc.example.com'],
  [{ syncApiUrl: 'http://abc.example.com' }, null],
  [{ syncApiUrl: '' }, null],
  [{ syncApiUrl: 42 }, null],
  [{}, null],
  [undefined, null],
])('reads the URL of %p as %p', (extra, expected) => {
  expect(syncApiUrlOf(extra)).toBe(expected)
})

it('reads the URL from the app config, and gives null without one', () => {
  constants.expoConfig = { extra: { syncApiUrl: 'https://abc.example.com' } }
  expect(readSyncApiUrl()).toBe('https://abc.example.com')
  constants.expoConfig = null
  expect(readSyncApiUrl()).toBeNull()
})
