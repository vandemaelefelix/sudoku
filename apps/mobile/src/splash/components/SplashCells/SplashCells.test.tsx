import { createPicture } from '@shopify/react-native-skia'
import { render, screen } from '@testing-library/react-native'
import { useSharedValue } from 'react-native-reanimated'
import { SPLASH_COLORS } from '@/theme/splash.colors'
import { SplashCells } from './SplashCells'

function Cells() {
  const exit = useSharedValue(500)
  return (
    <SplashCells exit={exit} width={390} height={844} tint={SPLASH_COLORS.light.tint} line={SPLASH_COLORS.light.line} />
  )
}

it('draws the cells in one Skia picture that does not take touches', () => {
  render(<Cells />)
  expect(screen.getByTestId('skia-canvas').props.pointerEvents).toBe('none')
  expect(screen.getByTestId('skia-picture')).toBeTruthy()
  expect(createPicture).toHaveBeenCalled()
})
