import { useEffect, useState } from 'react'
import { LEVELS, type Streak } from '@sudoku/core'
import { TIMES_COUNT } from '@/stats/constants/stats.constants'
import type { Level, LevelSummary } from '@/storage'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { deviceTimeZone } from '@/utils/timeZone.utils'
import { devWarn, errorMessage } from '@/utils/log.utils'

export type StatsData = {
  overall: LevelSummary
  levels: Record<Level, LevelSummary>
  times: Record<Level, readonly number[]>
  streak: Streak
}

export type StatsState = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; data: StatsData }

/**
 * Reads every number of the stats screen at once, so a tab change shows no wait. It reads again when the filter changes
 * and keeps the old numbers on screen until the new ones arrive. A new `reloadKey` reads again, for example after a reset.
 */
export function useStats(includeScanned: boolean, reloadKey = 0): StatsState {
  const { stats } = useGameStorage()
  const [state, setState] = useState<StatsState>({ status: 'loading' })

  useEffect(() => {
    let live = true
    const filter = { includeScanned }
    Promise.all([
      stats.summary(null, filter),
      stats.byLevel(filter),
      stats.streak(deviceTimeZone(), filter),
      Promise.all(LEVELS.map((level) => stats.recentTimes(level, TIMES_COUNT, filter))),
    ])
      .then(([overall, levels, streak, recent]) => {
        if (!live) return
        const timesOf = Object.fromEntries(LEVELS.map((level, index) => [level, recent[index] ?? []])) as Record<
          Level,
          number[]
        >
        const times: Record<Level, readonly number[]> = timesOf
        setState({ status: 'ready', data: { overall, levels, times, streak } })
      })
      .catch((error: unknown) => {
        devWarn('storage', `The stats do not load: ${errorMessage(error)}`)
        if (live) setState({ status: 'failed' })
      })
    return () => {
      live = false
    }
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- reloadKey only triggers a new read.
  }, [stats, includeScanned, reloadKey])

  return state
}
