import { act, render } from '@testing-library/react-native'
import { useEffect } from 'react'
import { createGame, planHint, type HintRung, type NewGame } from '@sudoku/core'
import { DEFAULT_ASSISTS } from '@/game/constants/assists.constants'
import { GameProvider } from '@/game/components/GameProvider'
import { NO_PULSE } from '@/constants/pulse.constants'
import { useGameActions } from '@/game/hooks/useGameActions'
import type { Pulse } from '@/hooks/usePulse'
import type { GameActions } from '@/game/utils/gameSession.utils'
import { cellViews } from '@/game/utils/cell.utils'
import { hintHighlight } from '@/game/utils/hint.utils'
import { pointingStart, sampleStart } from '@/game/utils/sample.utils'
import { Grid } from './Grid'

const mockSeen = { renders: 0, pulses: new Set<Pulse | undefined>() }

jest.mock('@/game/components/Cell', () => {
  const { createElement, memo } = jest.requireActual<typeof import('react')>('react')
  const actual = jest.requireActual<typeof import('@/game/components/Cell')>('@/game/components/Cell')
  return {
    Cell: memo((props: Parameters<typeof actual.Cell>[0]) => {
      mockSeen.renders += 1
      mockSeen.pulses.add(props.pulse)
      return createElement(actual.Cell, props)
    }),
  }
})

// Row 0 of the canvas puzzle lacks only cell 2. Its solution is 4.
function rowAlmostDone(): NewGame {
  const sample = sampleStart()
  const entries = sample.solution.map((value, cell) =>
    cell < 9 && cell !== 2 && sample.givens[cell] === 0 ? value : 0,
  )
  return { ...sample, entries }
}

const remote: { actions: GameActions | null } = { actions: null }

function Remote() {
  const actions = useGameActions()
  useEffect(() => {
    remote.actions = actions
  }, [actions])
  return null
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('renders only the changed cells on a move that completes a row, and nothing while the pulse runs', () => {
  render(
    <GameProvider start={rowAlmostDone()}>
      <Grid />
      <Remote />
    </GameProvider>,
  )
  act(() => remote.actions?.select(2))
  mockSeen.renders = 0
  act(() => remote.actions?.digit(4))
  expect(mockSeen.renders).toBeGreaterThan(0)
  expect(mockSeen.renders).toBeLessThan(81)
  const afterMove = mockSeen.renders
  const [pulse] = [...mockSeen.pulses]
  expect(pulse?.delays.get().slice(0, 9)).not.toContain(NO_PULSE)
  act(() => jest.advanceTimersByTime(2000))
  expect(mockSeen.renders).toBe(afterMove)
  expect(mockSeen.pulses.size).toBe(1)
})

it('renders only the cells whose role changes when a hint opens', () => {
  render(
    <GameProvider start={sampleStart()}>
      <Grid />
      <Remote />
    </GameProvider>,
  )
  mockSeen.renders = 0
  act(() => remote.actions?.hint())
  // The look rung marks only the focus unit: nine cells.
  expect(mockSeen.renders).toBe(9)
})

it('renders only the cells whose role changes on each rung change', () => {
  const start = pointingStart()
  const game = createGame(start)
  const plan = planHint(game)
  if (plan === null) throw new Error('expected a plan')
  const views = (rung: HintRung) => cellViews(game, DEFAULT_ASSISTS, hintHighlight({ plan, step: 0, rung }))
  const changed = (from: HintRung, to: HintRung) =>
    views(to).filter((view, cell) => JSON.stringify(view) !== JSON.stringify(views(from)[cell])).length
  render(
    <GameProvider start={start}>
      <Grid />
      <Remote />
    </GameProvider>,
  )
  act(() => remote.actions?.hint())
  for (const rung of [2, 3] as const) {
    mockSeen.renders = 0
    act(() => remote.actions?.hintCard('hintMore'))
    expect(mockSeen.renders).toBe(changed((rung - 1) as HintRung, rung))
    act(() => jest.advanceTimersByTime(2000))
    expect(mockSeen.renders).toBe(changed((rung - 1) as HintRung, rung))
  }
})
