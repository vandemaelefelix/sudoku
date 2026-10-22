import type { Level } from '@sudoku/core'
import type { MessageId } from '@/i18n/messages'

/** The message id of each level name (ADR-033). */
export const LEVEL_LABELS: Readonly<Record<Level, MessageId>> = {
  easy: 'level.easy',
  medium: 'level.medium',
  hard: 'level.hard',
  expert: 'level.expert',
}

export const LEVEL_NAMES: Readonly<Record<Level, string>> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
}
