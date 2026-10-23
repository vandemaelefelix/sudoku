import { fireEvent, render, screen } from '@testing-library/react-native'
import { IntlProvider } from 'react-intl'
import { CATALOGUES } from '@/i18n/messages'
import { FailurePanel } from './FailurePanel'

const NO_GRID_REASON = 'no grid in the photo'

function panel(over: Partial<Parameters<typeof FailurePanel>[0]> = {}) {
  const onChooseImage = jest.fn()
  const onRetake = jest.fn()
  const view = render(
    <FailurePanel
      failure={NO_GRID_REASON}
      importFailed={false}
      onChooseImage={onChooseImage}
      onRetake={onRetake}
      {...over}
    />,
  )
  return { onChooseImage, onRetake, view }
}

describe('FailurePanel', () => {
  it('tells the player to hold the phone over the grid when the photo has no grid', () => {
    panel()
    expect(screen.getByTestId('correction-failure')).toHaveTextContent(/The scan failed/)
    expect(screen.getByText('No grid in the photo. Hold the phone over the whole grid.')).toBeTruthy()
  })

  it('calls onRetake from Retake, and offers no other image', () => {
    const { onRetake, onChooseImage } = panel()
    fireEvent.press(screen.getByTestId('retake-failure'))
    expect(onRetake).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('choose-another')).toBeNull()
    expect(onChooseImage).not.toHaveBeenCalled()
  })

  it('reads a reason that it does not know as a plain failure', () => {
    panel({ failure: 'the file is not an image' })
    expect(screen.getByTestId('correction-failure')).toHaveTextContent(/The scan failed/)
    expect(screen.getByText('Something went wrong. Try again.')).toBeTruthy()
  })

  it('offers another image when an import has no grid', () => {
    const { onChooseImage, onRetake } = panel({ importFailed: true })
    expect(screen.getByTestId('correction-failure')).toHaveTextContent(/No sudoku found/)
    expect(screen.getByText('Choose an image that shows the whole grid.')).toBeTruthy()
    expect(screen.queryByTestId('retake-failure')).toBeNull()
    fireEvent.press(screen.getByTestId('choose-another'))
    expect(onChooseImage).toHaveBeenCalledTimes(1)
    expect(onRetake).not.toHaveBeenCalled()
  })

  it('offers another image when an import fails for another reason', () => {
    panel({ failure: 'the file is not an image', importFailed: true })
    expect(screen.getByTestId('correction-failure')).toHaveTextContent(/The scan failed/)
    expect(screen.getByText('Something went wrong. Try again.')).toBeTruthy()
    expect(screen.getByTestId('choose-another')).toBeTruthy()
    expect(screen.queryByTestId('retake-failure')).toBeNull()
  })

  it('shows the failure in Dutch', () => {
    render(
      <IntlProvider locale="nl-BE" messages={CATALOGUES.nl}>
        <FailurePanel failure={NO_GRID_REASON} importFailed={false} onChooseImage={jest.fn()} onRetake={jest.fn()} />
      </IntlProvider>,
    )
    expect(screen.getByTestId('correction-failure')).toHaveTextContent(/De scan is mislukt/)
    expect(screen.getByText('Geen rooster op de foto. Houd de telefoon boven het hele rooster.')).toBeTruthy()
    expect(screen.getByText('Opnieuw')).toBeTruthy()
  })
})
