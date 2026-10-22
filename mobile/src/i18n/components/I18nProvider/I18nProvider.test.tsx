import { act, render, screen } from '@testing-library/react-native'
import { useLocales } from 'expo-localization'
import { Text } from 'react-native'
import { useIntl } from '@/i18n/hooks/useIntl'
import { useLanguage } from '@/i18n/hooks/useLanguage'
import { I18nProvider } from './I18nProvider'

jest.mock('expo-localization', () => ({ useLocales: jest.fn() }))

let choose: ReturnType<typeof useLanguage>['choose'] = () => undefined

function Title() {
  const intl = useIntl()
  choose = useLanguage().choose
  return <Text testID="title">{`${intl.formatMessage({ id: 'settings.language.title' })} ${intl.locale}`}</Text>
}

function deviceIn(...tags: string[]) {
  jest
    .mocked(useLocales)
    .mockReturnValue(tags.map((tag) => ({ languageTag: tag, languageCode: tag.split('-')[0] })) as never)
}

it('follows the iOS language with System', () => {
  deviceIn('nl-BE', 'en-GB')
  render(
    <I18nProvider>
      <Title />
    </I18nProvider>,
  )
  expect(screen.getByTestId('title')).toHaveTextContent('Taal nl-BE')
})

it('switches the language at once when the player chooses one', () => {
  deviceIn('nl-BE')
  render(
    <I18nProvider>
      <Title />
    </I18nProvider>,
  )
  act(() => choose('en'))
  expect(screen.getByTestId('title')).toHaveTextContent('Language en')
  act(() => choose('system'))
  expect(screen.getByTestId('title')).toHaveTextContent('Taal nl-BE')
})

it('falls back to English for an iOS language that the app does not have', () => {
  deviceIn('fr-BE')
  render(
    <I18nProvider>
      <Title />
    </I18nProvider>,
  )
  expect(screen.getByTestId('title')).toHaveTextContent('Language en')
})
