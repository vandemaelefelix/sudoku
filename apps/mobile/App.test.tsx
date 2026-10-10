import { render, screen } from '@testing-library/react-native'

describe('App', () => {
  it('opens on the camera screen', () => {
    // App logs the fast-opencv probe when it loads. Keep the test output clean.
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const App = (jest.requireActual('./App') as typeof import('./App')).default
    log.mockRestore()
    render(<App />)
    expect(screen.getByTestId('camera')).toBeTruthy()
  })
})
