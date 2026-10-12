import { act, render, screen } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { GameProvider } from '@/game/components/GameProvider'
import { sampleStart } from '@/game/utils/sample.utils'
import { TimerPill } from './TimerPill'

const renderInGame = (ui: ReactElement) => render(<GameProvider start={sampleStart()}>{ui}</GameProvider>)

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('shows the time played', () => {
  renderInGame(<TimerPill />)
  expect(screen.getByText('00:00')).toBeTruthy()
  act(() => jest.advanceTimersByTime(65_000))
  expect(screen.getByText('01:05')).toBeTruthy()
})
