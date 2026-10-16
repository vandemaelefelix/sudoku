import { fireEvent, render } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { POLICY_URL } from '@/scanShare/constants/scanShare.constants'
import { ScanShareNotice } from './ScanShareNotice'

let mockDue = true
const mockAccept = jest.fn()
const mockDecline = jest.fn()
jest.mock('@/scanShare/useScanShare', () => ({
  useScanShare: () => ({ noticeDue: mockDue, acceptNotice: mockAccept, declineNotice: mockDecline }),
}))

beforeEach(() => {
  mockDue = true
  mockAccept.mockClear()
  mockDecline.mockClear()
})

it('shows the title, the text and the policy link', () => {
  const { getByText, getByLabelText } = render(<ScanShareNotice />)
  getByText('Help improve the app')
  getByText('Got it')
  getByText('Turn off')
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  fireEvent.press(getByLabelText('Privacy policy'))
  expect(Linking.openURL).toHaveBeenCalledWith(POLICY_URL)
})

it('"Got it" accepts and "Turn off" declines', () => {
  const { getByTestId } = render(<ScanShareNotice />)
  fireEvent.press(getByTestId('notice-accept'))
  expect(mockAccept).toHaveBeenCalledTimes(1)
  fireEvent.press(getByTestId('notice-decline'))
  expect(mockDecline).toHaveBeenCalledTimes(1)
})

it('shows nothing when no notice is due', () => {
  mockDue = false
  const { queryByText } = render(<ScanShareNotice />)
  expect(queryByText('Help improve the app')).toBeNull()
})
