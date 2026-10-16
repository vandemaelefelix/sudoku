import { MAX_MISTAKES, type Game } from '@sudoku/core'
import { LEVEL_NAMES } from '@/constants/level.constants'
import { DATE_FORMAT, DATE_LOCALE, NO_BEST } from '@/game/constants/finish.constants'
import { formatClock } from '@/game/utils/time.utils'
import type { Level, PuzzleSource } from '@/storage'

/** bestBeforeMs is the best time of the level before this game, or null when the level has none. */
export type FinishInfo = {
  readonly level: Level
  readonly source: PuzzleSource
  readonly seed: number | null
  readonly bestBeforeMs: number | null
}

export type FinishView = {
  title: string
  newBest: boolean
  time: string
  mistakes: string
  hints: string
  best: string
  source: string
  fromPaper: boolean
  date: string
  /** The VoiceOver label of the whole card. */
  label: string
}

export function formatPuzzleNumber(seed: number): string {
  return String(seed).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function sourceText(info: FinishInfo): string {
  if (info.source === 'scanned') return 'Scanned from paper'
  return info.seed === null ? 'Generated puzzle' : `Puzzle ${formatPuzzleNumber(info.seed)}`
}

/** The same rule as HistoryRepository.bestTimes (ADR-012): only a won generated game without hints counts. */
export function finishView(board: Game, playedMs: number, info: FinishInfo, finishedAt: Date): FinishView {
  const counts = info.source === 'generated' && board.hintsUsed === 0
  const newBest = counts && (info.bestBeforeMs === null || playedMs < info.bestBeforeMs)
  const bestMs = newBest ? playedMs : info.bestBeforeMs
  const title = `Solved · ${LEVEL_NAMES[info.level]}`
  const time = formatClock(playedMs)
  const best = bestMs === null ? NO_BEST : formatClock(bestMs)
  const source = sourceText(info)
  const date = finishedAt.toLocaleDateString(DATE_LOCALE, DATE_FORMAT)
  const label = [
    title,
    ...(newBest ? ['New best'] : []),
    `Time ${time}`,
    `${board.mistakes} of ${MAX_MISTAKES} mistakes`,
    `${board.hintsUsed} hints`,
    `Best ${best}`,
    source,
    date,
  ].join('. ')
  return {
    title,
    newBest,
    time,
    mistakes: `${board.mistakes}/${MAX_MISTAKES}`,
    hints: String(board.hintsUsed),
    best,
    source,
    fromPaper: info.source === 'scanned',
    date,
    label,
  }
}
