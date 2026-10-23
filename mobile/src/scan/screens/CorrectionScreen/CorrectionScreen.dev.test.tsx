import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { CaptureOk, CaptureResult } from '@/scan/utils/captureResult.utils'
import { capturing, okResult, review } from '@/scan/scanTestKit'
import { cobalt } from '@/theme/themes/cobalt'
import { CorrectionScreen } from './CorrectionScreen'
import { clock, given, layout, press, shaky, style } from './CorrectionScreen.testKit'

jest.mock('@/scan/components/ScanInspector', () => {
  const { View } = jest.requireActual('react-native')
  const { createElement } = jest.requireActual('react')
  return {
    ...jest.requireActual('@/scan/components/ScanInspector/ScanTabs'),
    ScanInspector: ({ view, threshold }: { view: string; threshold: number }) =>
      createElement(View, { testID: `inspector-${view}`, threshold }),
  }
})

const withPhoto = (): CaptureResult => ({
  ...(okResult({ 0: given, 1: shaky(3, 0.85) }) as CaptureOk),
  photoPath: '/tmp/photo.jpg',
})

const devUi = (onSave?: (looks: readonly unknown[]) => Promise<boolean>, result = withPhoto()) => {
  const onPlay = jest.fn()
  render(
    <CorrectionScreen
      session={review(result)}
      layout={layout}
      onRetake={jest.fn()}
      onPlay={onPlay}
      {...(onSave ? { onSave } : {})}
    />,
  )
  press('dev-open')
  return onPlay
}

describe('CorrectionScreen dev menu', () => {
  it('opens from the wrench and closes again', () => {
    devUi()
    expect(screen.getByTestId('dev-menu')).toBeTruthy()
    press('dev-close')
    expect(screen.queryByTestId('dev-menu')).toBeNull()
  })

  it('has no wrench during the transition', () => {
    render(
      <CorrectionScreen session={capturing(withPhoto(), { clock: clock(1.5) })} layout={layout} onRetake={jest.fn()} />,
    )
    expect(screen.queryByTestId('dev-open')).toBeNull()
  })

  it('shows the four tabs and swaps the inspector view', () => {
    devUi()
    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(screen.getByTestId('inspector-photo')).toBeTruthy()
    press('tab-cells')
    expect(screen.getByTestId('inspector-cells')).toBeTruthy()
    expect(screen.getByTestId('correction-cell-0')).toBeTruthy()
  })

  it('saves the final looks, while Play still works', async () => {
    const onSave = jest.fn(async (_looks: readonly unknown[]) => true)
    devUi(onSave)
    expect(screen.getByTestId('play')).toBeTruthy()
    expect(screen.getByTestId('save')).toHaveTextContent('Save corrections')
    press('save')
    await waitFor(() => expect(screen.getByTestId('save')).toHaveTextContent('Saved ✓'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0]![0]).toHaveLength(81)
  })

  it('says when the save failed, and lets the developer try again', async () => {
    devUi(jest.fn(async () => false))
    press('save')
    await waitFor(() => expect(screen.getByTestId('save')).toHaveTextContent('Not saved. Try again'))
    expect(screen.getByTestId('save').props.accessibilityState.disabled).toBe(false)
  })

  it('has no Save without the photo file', () => {
    devUi(jest.fn(), okResult())
    expect(screen.queryByTestId('save')).toBeNull()
  })

  it('moves the rings at once with the threshold slider', () => {
    devUi()
    expect(screen.queryByTestId('correction-ring-1')).toBeNull()
    fireEvent(screen.getByTestId('threshold-slider'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    })
    expect(screen.queryByTestId('correction-ring-1')).toBeNull()
    for (let step = 0; step < 9; step++) {
      fireEvent(screen.getByTestId('threshold-slider'), 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      })
    }
    expect(screen.getByTestId('correction-ring-1')).toBeTruthy()
    expect(screen.getByTestId('inspector-photo').props.threshold).toBeCloseTo(0.9, 6)
  })

  it('shows the kind and the confidence in each cell', () => {
    devUi()
    fireEvent.press(screen.getByTestId('switch-Show confidence'))
    expect(screen.getByTestId('correction-confidence-1')).toHaveTextContent('85')
    expect(screen.getByTestId('correction-confidence-0')).toHaveTextContent('100')
  })

  it('labels the kind of an open cell when Label kinds is on', () => {
    devUi()
    fireEvent.press(screen.getByTestId('switch-Label kinds'))
    press('dev-close')
    press('correction-press-0')
    press('correction-kind-entry')
    expect(style('correction-cell-0')).toMatchObject({ color: cobalt.components.cell.entry })
    press('correction-kind-notes')
    expect(screen.getByTestId('correction-cell-0')).toHaveTextContent('')
    expect(screen.getByTestId('correction-check')).toBeTruthy()
  })

  it('shows no kind labels without the switch', () => {
    devUi()
    press('dev-close')
    press('correction-press-0')
    expect(screen.queryByTestId('correction-kinds')).toBeNull()
  })
})
