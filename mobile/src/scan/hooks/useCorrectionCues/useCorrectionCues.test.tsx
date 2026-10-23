import { renderHook, waitFor } from '@testing-library/react-native'
import { type SharedValue, useAnimatedReaction } from 'react-native-reanimated'
import { GATE_RESULTS } from '@/scan/constants/transition.constants'
import type { SweepTiming } from '@/scan/utils/transition.utils'
import { useCorrectionCues } from './useCorrectionCues'

const mockPlay = jest.fn()
jest.mock('@/settings/hooks/useHaptics', () => ({
  useHaptics: () => ({ on: true, setOn: jest.fn(), play: mockPlay }),
}))

const shared = (value: number) => ({ value }) as SharedValue<number>
const REVIEW: SweepTiming = { crossFade: false }

type Props = Partial<Parameters<typeof useCorrectionCues>[0]>
const cues = (over: Props = {}) => ({
  timing: REVIEW,
  recognised: false,
  failed: false,
  editable: false,
  selected: null,
  ready: false,
  celebrated: false,
  ...over,
})
const successes = () => mockPlay.mock.calls.filter(([name]) => name === 'success')

type Reaction = { prepare: () => boolean; react: (now: boolean, previous: boolean | null) => void }
/** The two reactions of the last render, in the order that the hook declares them: the results gate, then the failure. */
function reactions(): { gate: Reaction; failure: Reaction } {
  const [gate, failure] = jest.mocked(useAnimatedReaction).mock.calls.slice(-2) as unknown as [
    [Reaction['prepare'], Reaction['react']],
    [Reaction['prepare'], Reaction['react']],
  ]
  return {
    gate: { prepare: gate[0], react: gate[1] },
    failure: { prepare: failure[0], react: failure[1] },
  }
}

beforeEach(() => {
  mockPlay.mockClear()
  jest.mocked(useAnimatedReaction).mockClear()
})

describe('the celebration', () => {
  it('plays success once when the celebration starts, and not again while it stays on', () => {
    const { rerender } = renderHook((props: Props) => useCorrectionCues(cues(props)), { initialProps: {} })
    expect(mockPlay).not.toHaveBeenCalled()
    rerender({ celebrated: true })
    rerender({ celebrated: true })
    expect(successes()).toHaveLength(1)
  })
})

describe('the playable puzzle', () => {
  it('plays success when the last check opens the gate, and not for the first summary', () => {
    const { rerender } = renderHook((props: Props) => useCorrectionCues(cues(props)), {
      initialProps: { editable: true, ready: false },
    })
    expect(mockPlay).not.toHaveBeenCalled()
    rerender({ editable: true, ready: true })
    expect(successes()).toHaveLength(1)
  })

  it('plays no success for a scan that was playable from the start', () => {
    renderHook(() => useCorrectionCues(cues({ editable: true, ready: true })))
    expect(mockPlay).not.toHaveBeenCalled()
  })

  it('waits while a cell is open, and plays success when the summary shows the open gate', () => {
    const { rerender } = renderHook((props: Props) => useCorrectionCues(cues(props)), {
      initialProps: { editable: true, ready: false },
    })
    rerender({ editable: true, ready: true, selected: 3 })
    expect(mockPlay).not.toHaveBeenCalled()
    rerender({ editable: true, ready: true, selected: null })
    expect(successes()).toHaveLength(1)
  })

  it('plays nothing while the transition runs', () => {
    const { rerender } = renderHook((props: Props) => useCorrectionCues(cues(props)), {
      initialProps: { editable: false, ready: false },
    })
    rerender({ editable: false, ready: true })
    expect(mockPlay).not.toHaveBeenCalled()
  })
})

describe('the results gate', () => {
  it('plays success once when the gate opens for a recognised grid', async () => {
    const resultsAt = shared(-1)
    renderHook(() =>
      useCorrectionCues(cues({ timing: { clock: shared(0.6), resultsAt, crossFade: false }, recognised: true })),
    )
    const { gate } = reactions()
    expect(gate.prepare()).toBe(false)
    resultsAt.value = 0.7
    expect(gate.prepare()).toBe(true)
    gate.react(true, false)
    await waitFor(() => expect(mockPlay).toHaveBeenCalledWith('success'))
    gate.react(true, true)
    expect(mockPlay).toHaveBeenCalledTimes(1)
  })

  it('stays closed without a recognised grid', () => {
    renderHook(() =>
      useCorrectionCues(cues({ timing: { clock: shared(0.6), resultsAt: shared(0.7), crossFade: false } })),
    )
    expect(reactions().gate.prepare()).toBe(false)
  })
})

const failing = (clock: number, crossFade = false) =>
  cues({ timing: { clock: shared(clock), resultsAt: shared(-1), crossFade }, failed: true })

describe('the failure warning', () => {
  it('plays a warning when the failure panel starts to slide, from the results gate', async () => {
    renderHook(() => useCorrectionCues(failing(0.5)))
    const { failure } = reactions()
    expect(failure.prepare()).toBe(false)
    failure.react(false, null)
    expect(mockPlay).not.toHaveBeenCalled()
    failure.react(true, false)
    await waitFor(() => expect(mockPlay).toHaveBeenCalledWith('warning'))
    failure.react(true, true)
    expect(mockPlay).toHaveBeenCalledTimes(1)
  })

  it('opens at the results gate, and at any clock value in the cross-fade', () => {
    renderHook(() => useCorrectionCues(failing(GATE_RESULTS)))
    expect(reactions().failure.prepare()).toBe(true)
    renderHook(() => useCorrectionCues(failing(0, true)))
    expect(reactions().failure.prepare()).toBe(true)
  })

  it('does not warn for a scan that did not fail', () => {
    renderHook(() => useCorrectionCues(cues({ timing: { clock: shared(GATE_RESULTS), crossFade: false } })))
    expect(reactions().failure.prepare()).toBe(false)
  })
})
