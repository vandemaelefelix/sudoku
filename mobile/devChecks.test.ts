import { waitFor } from '@testing-library/react-native'
import { Mat } from 'react-native-fast-opencv'
import { runDevChecks } from './devChecks'

describe('runDevChecks', () => {
  const dev = __DEV__

  afterEach(() => {
    Reflect.set(globalThis, '__DEV__', dev)
    jest.restoreAllMocks()
  })

  it('logs the fast-opencv probe and the model parity in a development build', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    runDevChecks()
    expect(log).toHaveBeenCalledWith('[scanner] fast-opencv works')
    await waitFor(() => expect(log).toHaveBeenCalledWith(expect.stringContaining('[scanner] model parity')))
  })

  it('logs a fast-opencv probe that throws, and does not throw', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    jest.mocked(Mat.create).mockImplementationOnce(() => {
      throw new Error('native module missing')
    })
    expect(() => runDevChecks()).not.toThrow()
    expect(log).toHaveBeenCalledWith('[scanner] fast-opencv FAILED: native module missing')
    await waitFor(() => expect(log).toHaveBeenCalledWith(expect.stringContaining('[scanner] model parity')))
  })

  it('does nothing in a release build', () => {
    Reflect.set(globalThis, '__DEV__', false)
    jest.mocked(Mat.create).mockClear()
    runDevChecks()
    expect(Mat.create).not.toHaveBeenCalled()
  })
})
