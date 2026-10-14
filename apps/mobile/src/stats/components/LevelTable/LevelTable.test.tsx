import { render, screen } from '@testing-library/react-native'
import type { Level, LevelSummary } from '@/storage'
import { LevelTable } from './LevelTable'

const NOTHING: LevelSummary = {
  played: 0,
  won: 0,
  lost: 0,
  abandoned: 0,
  winRate: null,
  bestMs: null,
  averageMs: null,
  flawlessWins: 0,
  averageMistakes: null,
  averageHints: null,
}
const MEDIUM: LevelSummary = {
  played: 12,
  won: 9,
  lost: 3,
  abandoned: 2,
  winRate: 0.75,
  bestMs: 272_000,
  averageMs: 435_000,
  flawlessWins: 4,
  averageMistakes: 1.4,
  averageHints: 0.6,
}
const levels: Record<Level, LevelSummary> = { easy: NOTHING, medium: MEDIUM, hard: NOTHING, expert: NOTHING }

it('shows the four levels as columns', () => {
  render(<LevelTable levels={levels} />)
  for (const name of ['Easy', 'Medium', 'Hard', 'Expert']) {
    expect(screen.getByRole('columnheader', { name })).toBeTruthy()
  }
})

it('shows the numbers of a level, row by row', () => {
  render(<LevelTable levels={levels} />)
  expect(screen.getByLabelText('Medium, Played: 12')).toBeTruthy()
  expect(screen.getByLabelText('Medium, Win rate: 75%')).toBeTruthy()
  expect(screen.getByLabelText('Medium, Best time: 04:32')).toBeTruthy()
  expect(screen.getByLabelText('Medium, Average: 07:15')).toBeTruthy()
  expect(screen.getByLabelText('Medium, Flawless: 4')).toBeTruthy()
  expect(screen.getByLabelText('Medium, Mistakes: 1.4')).toBeTruthy()
  expect(screen.getByLabelText('Medium, Hints: 0.6')).toBeTruthy()
  expect(screen.getByLabelText('Medium, Abandoned: 2')).toBeTruthy()
})

it('shows a dash for a level without games, and 0 for the counts', () => {
  render(<LevelTable levels={levels} />)
  expect(screen.getByLabelText('Expert, Played: 0')).toBeTruthy()
  expect(screen.getByLabelText('Expert, Win rate: –')).toBeTruthy()
  expect(screen.getByLabelText('Expert, Flawless: –')).toBeTruthy()
  expect(screen.getByLabelText('Expert, Abandoned: 0')).toBeTruthy()
  expect(screen.queryByText(/NaN|Infinity/)).toBeNull()
})

it('explains how the numbers are counted, under the table', () => {
  render(<LevelTable levels={levels} />)
  expect(
    screen.getByText(
      'Best time counts wins without hints. Average counts all wins. Mistakes and hints are per game. Flawless means a win with no mistakes and no hints. Abandoned games are not counted.',
    ),
  ).toBeTruthy()
})
