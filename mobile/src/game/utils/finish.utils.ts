import { countsForBestTime, formatClock, MAX_MISTAKES, type Game } from '@sudoku/core'
import { LEVEL_LABELS } from '@/constants/level.constants'
import { DATE_FORMAT, NO_BEST } from '@/game/constants/finish.constants'
import type { Formatter } from '@/i18n/utils/intl.utils'
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

function sourceText(intl: Formatter, info: FinishInfo): string {
  if (info.source === 'scanned') return intl.formatMessage({ id: 'finish.scanned' })
  return info.seed === null
    ? intl.formatMessage({ id: 'finish.generated' })
    : intl.formatMessage({ id: 'finish.puzzle' }, { number: formatPuzzleNumber(info.seed) })
}

export function finishView(
  intl: Formatter,
  board: Game,
  playedMs: number,
  info: FinishInfo,
  finishedAt: Date,
): FinishView {
  const counts = countsForBestTime({ result: 'won', source: info.source, hintsUsed: board.hintsUsed })
  const newBest = counts && (info.bestBeforeMs === null || playedMs < info.bestBeforeMs)
  const bestMs = newBest ? playedMs : info.bestBeforeMs
  const title = intl.formatMessage(
    { id: 'finish.title' },
    { level: intl.formatMessage({ id: LEVEL_LABELS[info.level] }) },
  )
  const time = formatClock(playedMs)
  const best = bestMs === null ? NO_BEST : formatClock(bestMs)
  const source = sourceText(intl, info)
  const date = intl.formatDate(finishedAt, DATE_FORMAT)
  const label = [
    title,
    ...(newBest ? [intl.formatMessage({ id: 'finish.newBest' })] : []),
    intl.formatMessage({ id: 'game.time' }, { time }),
    intl.formatMessage({ id: 'game.mistakesOf' }, { count: board.mistakes, max: MAX_MISTAKES }),
    intl.formatMessage({ id: 'finish.hints' }, { count: board.hintsUsed }),
    intl.formatMessage({ id: 'finish.best' }, { best }),
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
