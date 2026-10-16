import type { StatsFilter, StatsRepository } from '@/storage'
import { deviceTimeZone } from '@/utils/timeZone.utils'

/** What the stats card of the home screen shows. */
export type HomeStats = { winRate: number | null; played: number; streak: number }

export async function loadHomeStats(stats: StatsRepository, filter: StatsFilter): Promise<HomeStats> {
  const [summary, streak] = await Promise.all([stats.summary(null, filter), stats.streak(deviceTimeZone(), filter)])
  return { winRate: summary.winRate, played: summary.played, streak: streak.current }
}
