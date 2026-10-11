import { createPicture, type SkImage } from '@shopify/react-native-skia'
import { render, screen } from '@testing-library/react-native'
import { useSharedValue } from 'react-native-reanimated'
import type { Quad } from '../../scanner'
import { LIGHT } from '../../theme/colors'
import { TransitionCanvas, type CaptureFrame } from './TransitionCanvas'
import { transitionAt } from './timeline'

const QUAD: Quad = [
  { x: 40, y: 100 },
  { x: 360, y: 100 },
  { x: 360, y: 420 },
  { x: 40, y: 420 },
]

function Harness({ crossFade }: { crossFade: boolean }) {
  const capture = useSharedValue<CaptureFrame | null>({ quad: QUAD, channels: transitionAt(0.4, crossFade) })
  const view = useSharedValue({ width: 402, height: 874 })
  return (
    <TransitionCanvas
      capture={capture}
      view={view}
      image={{ width: () => 900, height: () => 1600 } as unknown as SkImage}
      locked={[
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.2 },
        { x: 0.8, y: 0.8 },
        { x: 0.2, y: 0.8 },
      ]}
      crossFade={crossFade}
      side={320}
      colors={LIGHT}
    />
  )
}

beforeEach(() => jest.clearAllMocks())

it.each([false, true])('draws one picture over the view (cross-fade %s)', (crossFade) => {
  render(<Harness crossFade={crossFade} />)
  expect(screen.getByTestId('transition-canvas').props.pointerEvents).toBe('none')
  expect(screen.getByTestId('skia-picture')).toBeTruthy()
  expect(createPicture).toHaveBeenCalled()
})
