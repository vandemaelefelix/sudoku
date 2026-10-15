import Constants from 'expo-constants'
import { publishableKeyOf, readPublishableKey } from './clerkConfig.utils'

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: undefined } }))

const constants = Constants as unknown as { expoConfig: { extra?: Record<string, unknown> } | null | undefined }

it.each([
  [{ clerkPublishableKey: 'pk_test_abc' }, 'pk_test_abc'],
  [{ clerkPublishableKey: '' }, null],
  [{ clerkPublishableKey: 42 }, null],
  [{}, null],
  [undefined, null],
])('reads the key of %p as %p', (extra, expected) => {
  expect(publishableKeyOf(extra)).toBe(expected)
})

it('reads the key from the app config', () => {
  constants.expoConfig = { extra: { clerkPublishableKey: 'pk_test_abc' } }
  expect(readPublishableKey()).toBe('pk_test_abc')
  constants.expoConfig = null
  expect(readPublishableKey()).toBeNull()
})
