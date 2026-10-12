import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { useSyncExternalStore } from 'react'
import { sampleStart } from '@/game/utils/sample.utils'
import { GameScreen } from './GameScreen'

const mockRenders = { grid: 0, cell: 0 }

jest.mock('@/game/components/Grid', () => {
  const actual = jest.requireActual<typeof import('@/game/components/Grid')>('@/game/components/Grid')
  return {
    Grid: () => {
      mockRenders.grid += 1
      return actual.Grid()
    },
  }
})

jest.mock('@/game/components/Cell', () => {
  const { createElement, memo } = jest.requireActual<typeof import('react')>('react')
  const actual = jest.requireActual<typeof import('@/game/components/Cell')>('@/game/components/Cell')
  return {
    Cell: memo((props: Parameters<typeof actual.Cell>[0]) => {
      mockRenders.cell += 1
      return createElement(actual.Cell, props)
    }),
  }
})

// The Unistyles mock never changes its theme. This store stands in for a theme switch: every useUnistyles caller re-renders.
const themeStore = { version: 0, listeners: new Set<() => void>() }
const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
const mockedUseUnistyles = unistyles.useUnistyles

function switchTheme() {
  act(() => {
    themeStore.version += 1
    for (const listener of themeStore.listeners) listener()
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(unistyles, 'useUnistyles').mockImplementation(() => {
    useSyncExternalStore(
      (listener) => {
        themeStore.listeners.add(listener)
        return () => themeStore.listeners.delete(listener)
      },
      () => themeStore.version,
    )
    return mockedUseUnistyles()
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

function renderScreen() {
  render(<GameScreen start={sampleStart()} onBack={jest.fn()} />)
  fireEvent(screen.getByTestId('board'), 'layout', { nativeEvent: { layout: { width: 358, height: 358 } } })
  mockRenders.grid = 0
  mockRenders.cell = 0
}

it('does not render the grid again on a clock tick', () => {
  renderScreen()
  act(() => jest.advanceTimersByTime(3000))
  expect(screen.getByText('00:03')).toBeTruthy()
  expect(mockRenders).toEqual({ grid: 0, cell: 0 })
})

it('does not render the grid again on a theme switch', () => {
  renderScreen()
  switchTheme()
  expect(mockRenders).toEqual({ grid: 0, cell: 0 })
})

it('renders only the cells that a move changes', () => {
  renderScreen()
  fireEvent.press(screen.getByTestId('cell-2'))
  expect(mockRenders.grid).toBe(1)
  expect(mockRenders.cell).toBeLessThan(81)
})
