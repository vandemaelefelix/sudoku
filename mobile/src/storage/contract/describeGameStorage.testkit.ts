import { describeAdopt } from './describeAdopt.testkit'
import { describeApplySyncPage } from './describeApplySyncPage.testkit'
import { describeClear } from './describeClear.testkit'
import { describeDeleteOwner } from './describeDeleteOwner.testkit'
import { describeOwner } from './describeOwner.testkit'
import { describePuzzles } from './describePuzzles.testkit'
import { describeStats } from './describeStats.testkit'
import { describeSubscribe } from './describeSubscribe.testkit'
import { describeSyncState } from './describeSyncState.testkit'
import { describeWaitingList } from './describeWaitingList.testkit'
import type { StorageOpener } from './fixtures.testkit'

/** The rules every GameStorage keeps: the SQLite one and the in-memory fake. One file holds each area. */
export function describeGameStorage(name: string, open: StorageOpener): void {
  // Each area opens its own storage in a beforeEach. The puzzles area has no describe of its own, because that would
  // change the test names. Its beforeEach therefore also runs for the other areas: one extra open for each test.
  describe(name, () => {
    describePuzzles(open)
    describeClear(open)
    describeOwner(open)
    describeWaitingList(open)
    describeApplySyncPage(open)
    describeAdopt(open)
    describeDeleteOwner(open)
    describeSyncState(open)
    describeSubscribe(open)
    describeStats(open)
  })
}
