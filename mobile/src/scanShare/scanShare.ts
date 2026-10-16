import type { RecogniseResult } from '@/scanner'
import type { CellLook } from '@/scan/utils/correction.utils'
import { devWarn, errorMessage } from '@/utils/log.utils'
import { buildRecord } from './buildRecord'
import type { CroppedPhoto } from './cropPhoto'
import type { ScanQueue } from './queue'

export type ScanShareDeps = {
  queue(): Promise<ScanQueue>
  isOn(): boolean
  setOn(on: boolean): Promise<void>
  contributorId(): Promise<string>
  newId(): string
  now(): number
  appVersion: string
  modelVersion: string
  crop(photoPath: string, result: Extract<RecogniseResult, { ok: true }>): Promise<CroppedPhoto>
  /** Saves the JPEG for the queue and returns its path. */
  writePhoto(scanId: string, jpeg: Uint8Array): string
  deletePhoto(path: string): void
  /** Tells the first-upload notice that a scan waits. */
  onQueued(): void
  /** Saves that the player answered the first-upload notice. */
  markNoticeSeen(): Promise<void>
  /** Sends the due scans. */
  drainQueue(): Promise<void>
}

export type ScanShare = {
  /**
   * Adds a finished scan to the queue and starts a drain. Never throws and never waits for the network (SUD-01).
   * Queues nothing when sharing is off, when the photo is not there, or when the record breaks the contract.
   * Deletes the original photo in every case: the queue keeps its own cropped copy.
   */
  enqueueScan(photoPath: string | undefined, result: RecogniseResult, finalGrid: readonly CellLook[]): Promise<void>
  /** Deletes a photo that the player does not share, for example after Retake. Never throws. */
  discardPhoto(photoPath: string): void
  /** Turning sharing off clears the queue and deletes the photos. Nothing uploads later. */
  setShareScans(on: boolean): Promise<void>
  /** "Got it": the notice is seen and the waiting scans go out. */
  acceptNotice(): Promise<void>
  /** "Turn off": sharing goes off and the queue clears, then the notice counts as seen. */
  declineNotice(): Promise<void>
}

export function createScanShare(deps: ScanShareDeps): ScanShare {
  return {
    async enqueueScan(photoPath, result, finalGrid) {
      try {
        await enqueue(deps, photoPath, result, finalGrid)
      } finally {
        if (photoPath !== undefined) discard(deps, photoPath)
      }
    },
    discardPhoto(photoPath) {
      discard(deps, photoPath)
    },
    async setShareScans(on) {
      await deps.setOn(on)
      if (!on) await clearQueue(deps)
    },
    async acceptNotice() {
      await deps.markNoticeSeen()
      void deps.drainQueue()
    },
    async declineNotice() {
      await this.setShareScans(false)
      await deps.markNoticeSeen()
    },
  }
}

async function enqueue(
  deps: ScanShareDeps,
  photoPath: string | undefined,
  result: RecogniseResult,
  finalGrid: readonly CellLook[],
): Promise<void> {
  if (!deps.isOn() || !result.ok || photoPath === undefined) return
  try {
    const scanId = deps.newId()
    const cropped = await deps.crop(photoPath, result)
    const record = buildRecord({
      scanId,
      contributorId: await deps.contributorId(),
      appVersion: deps.appVersion,
      modelVersion: deps.modelVersion,
      corners: cropped.corners,
      cells: result.cells,
      looks: finalGrid,
    })
    if (record === null) {
      devWarn('scanShare', 'the scan record is not valid, so the scan is not shared')
      return
    }
    // The player can turn sharing off while the crop runs. The check comes right before the write.
    if (!deps.isOn()) return
    const path = deps.writePhoto(scanId, cropped.jpeg)
    await (await deps.queue()).enqueue({ scanId, record: JSON.stringify(record), photoPath: path }, deps.now())
    if (!deps.isOn()) {
      await clearQueue(deps)
      return
    }
    deps.onQueued()
    void deps.drainQueue()
  } catch (error) {
    devWarn('scanShare', `the scan is not queued: ${errorMessage(error)}`)
  }
}

function discard(deps: ScanShareDeps, path: string): void {
  try {
    deps.deletePhoto(path)
  } catch (error) {
    devWarn('scanShare', `the photo is not deleted: ${errorMessage(error)}`)
  }
}

async function clearQueue(deps: ScanShareDeps): Promise<void> {
  try {
    for (const path of await (await deps.queue()).clear()) deps.deletePhoto(path)
  } catch (error) {
    devWarn('scanShare', `the queue is not cleared: ${errorMessage(error)}`)
  }
}
