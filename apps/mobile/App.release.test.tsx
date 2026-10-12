import { render, screen } from '@testing-library/react-native'

describe('App in a release build', () => {
  const dev = __DEV__

  afterEach(() => {
    Reflect.set(globalThis, '__DEV__', dev)
  })

  it('opens on the scan flow, not on the game screen', () => {
    // This file has its own module registry. App reads __DEV__ when it first loads, so set it before.
    Reflect.set(globalThis, '__DEV__', false)
    const App = (jest.requireActual('./App') as typeof import('./App')).default
    render(<App />)
    expect(screen.getByTestId('camera')).toBeTruthy()
    expect(screen.queryByLabelText('Back to home')).toBeNull()
  })
})
