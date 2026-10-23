import { renderHook } from '@testing-library/react-native'
import { type SharedValue, useAnimatedReaction, useReducedMotion } from 'react-native-reanimated'
import { GATE_RESULTS } from '@/scan/constants/transition.constants'
import { panelAt, shiftOf, transitionAt, type SweepTiming } from '@/scan/utils/transition.utils'
import { useCorrectionMotion } from './useCorrectionMotion'

const PANEL_HEIGHT = 170
const HIDDEN = PANEL_HEIGHT * 1.4
/** The mock of useAnimatedStyle returns the plain style object. */
const read = (handle: unknown) => handle as { opacity: number; transform: { translateY: number }[] }
const shared = <T,>(value: T) => ({ value }) as SharedValue<T>

type Input = Parameters<typeof useCorrectionMotion>[0]
const motionOf = (over: Partial<Input> & { timing: SweepTiming }) =>
  renderHook((props: Input) => useCorrectionMotion(props), {
    initialProps: { waiting: undefined, failed: false, panelHeight: PANEL_HEIGHT, ...over },
  })

/** The failure slide reaction of the last render: its condition and its handler. The mock runs neither. */
function slideReaction() {
  const [prepare, react] = jest.mocked(useAnimatedReaction).mock.calls.at(-1)! as unknown as [
    () => boolean,
    (go: boolean, previous: boolean | null) => void,
  ]
  return { prepare, react }
}

const failing = (clock: number, crossFade = false): Input => ({
  timing: { clock: shared(clock), resultsAt: shared(-1), crossFade },
  waiting: undefined,
  failed: true,
  panelHeight: PANEL_HEIGHT,
})

describe('the failure slide', () => {
  it('starts when the clock reaches the results gate, not when the failure comes', () => {
    const { result, rerender } = renderHook((props: Input) => useCorrectionMotion(props), {
      initialProps: failing(0.5),
    })
    expect(slideReaction().prepare()).toBe(false)
    expect(read(result.current.panelStyle).transform).toEqual([{ translateY: HIDDEN }])
    rerender(failing(GATE_RESULTS))
    const { prepare, react } = slideReaction()
    expect(prepare()).toBe(true)
    react(true, false)
    // The mock does not react to the shared value, so the next render reads the value that the reaction set.
    rerender(failing(GATE_RESULTS))
    expect(read(result.current.panelStyle).transform).toEqual([{ translateY: 0 }])
  })

  it('starts in the cross-fade with the clock held at 0', () => {
    const { result, rerender } = renderHook((props: Input) => useCorrectionMotion(props), {
      initialProps: failing(0, true),
    })
    const { prepare, react } = slideReaction()
    expect(prepare()).toBe(true)
    react(true, null)
    rerender(failing(0, true))
    expect(read(result.current.panelStyle).transform).toEqual([{ translateY: 0 }])
  })

  it('keeps the failure panel down before the results gate', () => {
    const { result } = renderHook(() => useCorrectionMotion(failing(0.5)))
    expect(read(result.current.panelStyle).transform).toEqual([{ translateY: HIDDEN }])
  })
})

describe('the panel, the title and the spinner', () => {
  it('shows every layer without a clock', () => {
    const { result } = motionOf({ timing: { crossFade: false } })
    expect(read(result.current.panelStyle).transform).toEqual([{ translateY: 0 }])
    expect(read(result.current.titleStyle).opacity).toBe(1)
  })

  it('moves the panel and the title with the clock, shifted by the arrival of the results', () => {
    const timing = { clock: shared(1.4), resultsAt: shared(GATE_RESULTS), crossFade: false }
    const { result } = motionOf({ timing })
    const shift = shiftOf(1.4, timing.resultsAt, false)
    expect(shift).toBeGreaterThan(0)
    expect(read(result.current.panelStyle).transform[0]!.translateY).toBeCloseTo(
      (1 - panelAt(1.4, false, shift)) * HIDDEN,
      9,
    )
    expect(read(result.current.titleStyle).opacity).toBe(transitionAt(1.4, false).title)
  })

  it('fades the spinner in while the results wait, and out otherwise', () => {
    const timing = { clock: shared(0.5), crossFade: false }
    expect(read(motionOf({ timing, waiting: shared(true) }).result.current.waitingStyle).opacity).toBe(1)
    expect(read(motionOf({ timing, waiting: shared(false) }).result.current.waitingStyle).opacity).toBe(0)
    expect(read(motionOf({ timing }).result.current.waitingStyle).opacity).toBe(0)
  })
})

describe('motion', () => {
  it('is on for the sweep, and off in the cross-fade and with Reduce Motion', () => {
    expect(motionOf({ timing: { crossFade: false } }).result.current.motion).toBe(true)
    expect(motionOf({ timing: { crossFade: true } }).result.current.motion).toBe(false)
    jest.mocked(useReducedMotion).mockReturnValue(true)
    expect(motionOf({ timing: { crossFade: false } }).result.current.motion).toBe(false)
    jest.mocked(useReducedMotion).mockReturnValue(false)
  })
})
