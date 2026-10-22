import { renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { IntlProvider } from 'react-intl'
import { CATALOGUES } from '@/i18n/messages'
import { useIntl } from './useIntl'

function wrapper({ children }: { children: ReactNode }) {
  return (
    <IntlProvider locale="nl-BE" messages={CATALOGUES.nl}>
      {children}
    </IntlProvider>
  )
}

it('formats in the language of the provider', () => {
  const { result } = renderHook(() => useIntl(), { wrapper })
  expect(result.current.formatMessage({ id: 'settings.language.title' })).toBe('Taal')
})

it('formats in English without a provider', () => {
  const { result } = renderHook(() => useIntl())
  expect(result.current.formatMessage({ id: 'settings.language.title' })).toBe('Language')
})
