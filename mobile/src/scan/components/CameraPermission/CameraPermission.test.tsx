import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { CameraPermission } from './CameraPermission'
import { cobalt } from '@/theme/themes/cobalt'

describe('CameraPermission', () => {
  it('draws the message in the theme colours, so it stays readable in dark mode', () => {
    render(<CameraPermission block="denied" />)
    expect(StyleSheet.flatten(screen.getByTestId('camera-denied').props.style)).toMatchObject({
      backgroundColor: cobalt.colors.background,
    })
    expect(StyleSheet.flatten(screen.getByText(/needs the camera/).props.style)).toMatchObject({
      color: cobalt.colors.text,
    })
  })
})
