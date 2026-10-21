import type { HistoryRepository } from '@/storage'

type Deps = { history: HistoryRepository; owner: string; ask(): Promise<boolean> }

/**
 * The adopt prompt of the first sign-in (ADR-028, decision 3). It never asks twice for one account, and it
 * never moves the entries of another owner. A player with no games without an owner is not asked, and the answer
 * is not saved, so a later sign-in after more signed-out games can ask.
 */
export async function runAdoptStep({ history, owner, ask }: Deps): Promise<void> {
  if ((await history.adoptable(owner)) === 0) return
  await history.answerAdopt(owner, await ask())
}
