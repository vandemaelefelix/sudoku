import { createPicture } from '@shopify/react-native-skia'
import { render, screen } from '@testing-library/react-native'
import { useSharedValue } from 'react-native-reanimated'
import { SPLASH_GROUND } from '@/theme/splash.colors'
import { cobalt } from '@/theme/themes/cobalt'
import { SplashCells } from './SplashCells'

function Cells() {
  const exit = useSharedValue(500)
  return (
    <SplashCells
      exit={exit}
      width={390}
      height={844}
      ground={SPLASH_GROUND}
      tint={cobalt.colors.accent}
      line={cobalt.colors.line}
    />
  )
}

it('draws the cells in one Skia picture that does not take touches', () => {
  render(<Cells />)
  expect(screen.getByTestId('skia-canvas').props.pointerEvents).toBe('none')
  expect(screen.getByTestId('skia-picture')).toBeTruthy()
  expect(createPicture).toHaveBeenCalled()
})

it('draws the cells over a picture of the old screen in place of the plain ground', () => {
  const picture = { width: () => 780, height: () => 1688 } as never
  function OverPicture() {
    const exit = useSharedValue(0)
    return (
      <SplashCells
        exit={exit}
        groundImage={picture}
        width={390}
        height={844}
        ground={SPLASH_GROUND}
        tint={cobalt.colors.accent}
        line={cobalt.colors.line}
      />
    )
  }
  render(<OverPicture />)
  expect(screen.getByTestId('skia-picture')).toBeTruthy()
})
