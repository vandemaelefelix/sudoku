import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FinishInfo } from '@/game/utils/finish.utils'
import type { BestTimes, SavedProgress } from '@/storage'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { useOwner } from '@/storage/hooks/useOwner'
import { devWarn, errorMessage } from '@/utils/log.utils'

/**
 * The best times load after the game: they change only when a game finishes. reload reads them again after a restart.
 * finish is undefined until they load. Without them the screen shows no finish card, because the card compares
 * against the best time before this game.
 */
export function useBestTimes(progress: SavedProgress | null) {
  const { history } = useGameStorage()
  const owner = useOwner()
  const [best, setBest] = useState<BestTimes | null>(null)

  useEffect(() => {
    let live = true
    history
      .bestTimes(owner)
      .then((times) => live && setBest(times))
      .catch((error: unknown) => {
        devWarn('storage', `The best times do not load: ${errorMessage(error)}`)
        // Without best times the card still shows. It then knows no best time before this game.
        if (live) setBest({})
      })
    return () => {
      live = false
    }
  }, [history, owner])

  // start() runs after the save of the finished game, so a read after the start includes that game.
  const reload = useCallback(async () => {
    try {
      setBest(await history.bestTimes(owner))
    } catch (error) {
      devWarn('storage', `The best times do not load: ${errorMessage(error)}`)
    }
  }, [history, owner])

  const finish = useMemo<FinishInfo | undefined>(
    () =>
      progress === null || best === null
        ? undefined
        : {
            level: progress.level,
            source: progress.source,
            seed: progress.seed,
            bestBeforeMs: best[progress.level] ?? null,
          },
    [progress, best],
  )

  return { finish, reload }
}
