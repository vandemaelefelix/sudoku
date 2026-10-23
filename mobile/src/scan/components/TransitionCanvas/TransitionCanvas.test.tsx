import { createPicture, type SkImage } from '@shopify/react-native-skia'
import { render, screen } from '@testing-library/react-native'
import { useSharedValue } from 'react-native-reanimated'
import { TransitionCanvas } from './TransitionCanvas'
import type { CaptureFrame } from '@/scan/hooks/useCaptureSession'
import { transitionAt } from '@/scan/utils/transition.utils'
import type { Quad } from '@/utils/geometry.utils'

const QUAD: Quad = [
  { x: 40, y: 100 },
  { x: 360, y: 100 },
  { x: 360, y: 420 },
  { x: 40, y: 420 },
]

function Harness({ crossFade }: { crossFade: boolean }) {
  const captureFrame = useSharedValue<CaptureFrame | null>({
    quad: QUAD,
    grid: QUAD,
    channels: transitionAt(0.4, crossFade),
    crossFade,
  })
  const image = useSharedValue<SkImage | null>({ width: () => 900, height: () => 1600 } as unknown as SkImage)
  const view = useSharedValue({ width: 402, height: 874 })
  const locked: Quad = [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 0.2, y: 0.8 },
  ]
  return <TransitionCanvas session={{ captureFrame, image, quad: locked, crossFade }} view={view} side={320} />
}


it.each([false, true])('draws one picture over the view (cross-fade %s)', (crossFade) => {
  render(<Harness crossFade={crossFade} />)
  expect(screen.getByTestId('transition-canvas').props.pointerEvents).toBe('none')
  expect(screen.getByTestId('skia-picture')).toBeTruthy()
  expect(createPicture).toHaveBeenCalled()
})
