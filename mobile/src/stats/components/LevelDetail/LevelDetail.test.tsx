import { render, screen } from '@testing-library/react-native'
import type { LevelSummary } from '@/storage'
import { LevelDetail } from './LevelDetail'

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

it('shows the times and the game numbers of the level', () => {
  render(<LevelDetail level="medium" summary={MEDIUM} times={[300_000, 272_000]} />)
  expect(screen.getByLabelText('Best, no hints: 04:32')).toBeTruthy()
  expect(screen.getByLabelText('Average, no hints: 07:15')).toBeTruthy()
  expect(screen.getByLabelText('Win rate: 75%')).toBeTruthy()
  expect(screen.getByLabelText('Played, 9 won, 3 lost: 12')).toBeTruthy()
  expect(screen.getByLabelText('Flawless wins, no mistakes, no hints: 4')).toBeTruthy()
  expect(screen.getByLabelText('Mistakes, per game: 1.4')).toBeTruthy()
  expect(screen.getByLabelText('Hints, per game: 0.6')).toBeTruthy()
  expect(screen.getByLabelText('Abandoned, not counted: 2')).toBeTruthy()
  expect(screen.getByLabelText(/^Times of the last 2 wins/)).toBeTruthy()
})

it('shows the empty state for a level without games', () => {
  render(<LevelDetail level="expert" summary={NOTHING} times={[]} />)
  expect(screen.getByText('No Expert games yet.')).toBeTruthy()
  expect(screen.getByText('Finish one and your win rate, best time and average time show up here.')).toBeTruthy()
  expect(screen.queryByLabelText(/^Win rate/)).toBeNull()
})

it('shows the numbers of a level that has only abandoned games', () => {
  render(<LevelDetail level="hard" summary={{ ...NOTHING, abandoned: 1 }} times={[]} />)
  expect(screen.getByLabelText('Win rate: –')).toBeTruthy()
  expect(screen.getByLabelText('Abandoned, not counted: 1')).toBeTruthy()
})

it('shows a dash for the flawless wins of a level without a finished game, as the table does', () => {
  render(<LevelDetail level="hard" summary={{ ...NOTHING, abandoned: 1 }} times={[]} />)
  expect(screen.getByLabelText('Flawless wins, no mistakes, no hints: –')).toBeTruthy()
})

it('reads one win in the singular', () => {
  render(<LevelDetail level="medium" summary={MEDIUM} times={[300_000]} />)
  expect(screen.getByText('Last 1 win')).toBeTruthy()
})
