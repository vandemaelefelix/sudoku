import { render, screen } from '@testing-library/react-native'
import App from './App'

describe('App', () => {
  it('opens on the camera screen', () => {
    render(<App />)
    expect(screen.getByTestId('camera')).toBeTruthy()
  })
})
