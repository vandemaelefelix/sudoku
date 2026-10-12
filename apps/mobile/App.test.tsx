import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

describe('App', () => {
  it('opens on the game screen in a development build, and goes back to the camera', async () => {
    // App logs the fast-opencv probe when it loads. Keep the test output clean.
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const App = (jest.requireActual('./App') as typeof import('./App')).default
    // The parity check logs after the model loads. Wait for it before the spy goes away.
    await waitFor(() => expect(log).toHaveBeenCalledWith(expect.stringContaining('[scanner] model parity')))
    log.mockRestore()
    render(<App />)
    expect(screen.getByLabelText('Back to home')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Back to home'))
    expect(screen.getByTestId('camera')).toBeTruthy()
  })
})
