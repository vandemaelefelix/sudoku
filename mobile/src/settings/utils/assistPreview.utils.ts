import type { Game } from '@sudoku/core'
import { sampleStart } from '@/game/utils/sample.utils'
import { reduceSession, startSession, type SessionAction } from '@/game/utils/session.utils'
import { PREVIEW_ENTRIES, PREVIEW_SELECTED } from '@/settings/constants/assistPreview.constants'

/** The board of the preview. It plays the entries through the game rules, so a wrong entry is a real mistake. */
export function previewBoard(): Game {
  const actions: SessionAction[] = [
    ...PREVIEW_ENTRIES.flatMap(([cell, digit]): SessionAction[] => [
      { type: 'select', cell },
      { type: 'digit', digit },
    ]),
    { type: 'select', cell: PREVIEW_SELECTED },
  ]
  return actions.reduce(reduceSession, startSession(sampleStart())).game
}
