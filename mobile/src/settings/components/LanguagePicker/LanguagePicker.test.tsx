import { fireEvent, render, screen } from '@testing-library/react-native'
import { IntlProvider } from 'react-intl'
import { CATALOGUES } from '@/i18n/messages'
import { LanguagePicker } from './LanguagePicker'

it('offers System, English and Nederlands', () => {
  const onChange = jest.fn()
  render(<LanguagePicker value="system" onChange={onChange} />)
  expect(screen.getByText('System')).toBeTruthy()
  expect(screen.getByText('English')).toBeTruthy()
  fireEvent.press(screen.getByText('Nederlands'))
  expect(onChange).toHaveBeenCalledWith('nl')
})

it('names System in Dutch, and keeps the names of the languages', () => {
  render(
    <IntlProvider locale="nl" messages={CATALOGUES.nl}>
      <LanguagePicker value="nl" onChange={jest.fn()} />
    </IntlProvider>,
  )
  expect(screen.getByText('Systeem')).toBeTruthy()
  expect(screen.getByText('English')).toBeTruthy()
  expect(screen.getByText('Nederlands')).toBeTruthy()
})
