import { render, screen, waitFor } from '@testing-library/react-native'
import { Mat } from 'react-native-fast-opencv'

describe('App when the fast-opencv probe throws', () => {
  it('still opens on the camera screen and logs the failure', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    jest.mocked(Mat.create).mockImplementationOnce(() => {
      throw new Error('native module missing')
    })
    const App = (jest.requireActual('./App') as typeof import('./App')).default
    expect(log).toHaveBeenCalledWith('[scanner] fast-opencv FAILED: native module missing')
    // The parity check logs after the model loads. Wait for it before the spy goes away.
    await waitFor(() => expect(log).toHaveBeenCalledWith(expect.stringContaining('[scanner] model parity')))
    log.mockRestore()
    render(<App />)
    expect(screen.getByTestId('camera')).toBeTruthy()
  })
})
