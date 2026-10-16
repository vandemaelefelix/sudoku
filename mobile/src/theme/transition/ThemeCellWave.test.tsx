import { render } from '@testing-library/react-native'
import { SplashCells } from '@/splash/components/SplashCells'
import { SPLASH_GROUND } from '@/theme/splash.colors'
import { forest } from '@/theme/themes/forest'
import { ThemeCellWave } from './ThemeCellWave'

jest.mock('@/splash/components/SplashCells', () => ({ SplashCells: jest.fn(() => null) }))

const image = { width: () => 780, height: () => 1688, dispose: jest.fn() } as never

// The cells are a decoration over the picture. They use the Light variant of the target colourway in both appearances (ADR-026).
it.each(['light', 'colour'] as const)(
  'tints the cells with the Light accent of the colourway for a switch to %s',
  (appearance) => {
    jest.mocked(SplashCells).mockClear()
    render(
      <ThemeCellWave image={image} target={{ name: 'forest', appearance }} onSwitch={jest.fn()} onDone={jest.fn()} />,
    )
    expect(jest.mocked(SplashCells).mock.calls[0]?.[0]).toMatchObject({
      ground: SPLASH_GROUND,
      tint: forest.colors.accent,
      line: forest.colors.line,
      groundImage: image,
    })
  },
)
