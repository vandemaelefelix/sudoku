import { render } from '@testing-library/react-native'
import { AppState } from 'react-native'
import { ScanShareDrainer } from './ScanShareDrainer'

const mockDrain = jest.fn(async () => undefined)
jest.mock('@/scanShare/hooks/useScanShare', () => ({ useScanShare: () => ({ drainQueue: mockDrain }) }))

let appListener: (state: string) => void = () => undefined
let networkListener: (state: { isConnected?: boolean }) => void = () => undefined
jest.mock('expo-network', () => ({
  addNetworkStateListener: (listener: typeof networkListener) => {
    networkListener = listener
    return { remove: jest.fn() }
  },
}))

beforeEach(() => mockDrain.mockClear())

it('drains at start, when the app returns to the front and when the phone connects', () => {
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    appListener = listener as typeof appListener
    return { remove: jest.fn() }
  })
  render(<ScanShareDrainer />)
  expect(mockDrain).toHaveBeenCalledTimes(1)
  appListener('background')
  expect(mockDrain).toHaveBeenCalledTimes(1)
  appListener('active')
  expect(mockDrain).toHaveBeenCalledTimes(2)
  networkListener({ isConnected: false })
  expect(mockDrain).toHaveBeenCalledTimes(2)
  networkListener({ isConnected: true })
  expect(mockDrain).toHaveBeenCalledTimes(3)
})
