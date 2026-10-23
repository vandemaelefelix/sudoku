import type { MessageId } from '@/i18n/messages'
import { NO_GRID } from '@/scanner'

/** The message ids of the failure panel: its title and the line that says why. */
export type FailureCopy = { title: MessageId; reason: MessageId }

/**
 * The words of the failure panel. reason: the failure of the scan. A reason that the panel does not know reads as a plain failure,
 * and the log keeps the reason. importFailed: the panel offers another image, so for an import without a grid it says what to pick.
 */
export function failureCopy(reason: string | null, importFailed: boolean): FailureCopy {
  if (reason === NO_GRID) {
    return importFailed
      ? { title: 'scan.failure.importTitle', reason: 'scan.failure.importReason' }
      : { title: 'scan.failure.title', reason: 'scan.failure.noGrid' }
  }
  return { title: 'scan.failure.title', reason: 'scan.failure.other' }
}
