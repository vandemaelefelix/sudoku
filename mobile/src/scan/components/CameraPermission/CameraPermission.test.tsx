import { fireEvent, render, screen } from '@testing-library/react-native'
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

  it.each(['denied', 'missing'] as const)('offers a photo from the library when the camera is %s', (block) => {
    const onChooseImage = jest.fn()
    render(<CameraPermission block={block} onChooseImage={onChooseImage} />)
    fireEvent.press(screen.getByTestId('choose-image'))
    expect(onChooseImage).toHaveBeenCalledTimes(1)
  })

  it('offers no photo while the permission prompt is open', () => {
    render(<CameraPermission block="waiting" onChooseImage={jest.fn()} />)
    expect(screen.queryByTestId('choose-image')).toBeNull()
  })
})
