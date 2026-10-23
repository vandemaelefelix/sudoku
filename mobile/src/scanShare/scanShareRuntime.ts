import manifest from '@assets/models/manifest.json'
import Constants from 'expo-constants'
import { randomUUID } from 'expo-crypto'
import { Directory, File, Paths } from 'expo-file-system'
import { openDatabaseAsync } from 'expo-sqlite'
import { kvSettings } from '@/preferences/SettingsRepository'
import { devWarn, errorMessage } from '@/utils/log.utils'
import { QUEUE_DATABASE_NAME, QUEUE_FOLDER } from './constants/scanShare.constants'
import { cropPhoto } from './cropPhoto'
import { createScanQueue, type ScanQueue } from './queue'
import { readScanApi } from './scanConfig'
import { createScanShare } from './scanShare'
import { noticeStore } from './noticeStore'
import { shareStore } from './shareStore'
import { createContributorId } from './scanShareSettings'
import { skiaCodec } from './skiaCodec'
import { createDrain, createUploader } from './uploader'

export const contributorId = createContributorId(kvSettings, randomUUID)

// The account lives in React. The hook of useScanShare hands the current token source to this module.
let getToken: () => Promise<string | null> = async () => null
export function setTokenSource(next: () => Promise<string | null>): void {
  getToken = next
}

let opening: Promise<ScanQueue> | null = null
function queue(): Promise<ScanQueue> {
  opening ??= openDatabaseAsync(QUEUE_DATABASE_NAME)
    .then((db) => createScanQueue(db))
    .catch((error: unknown) => {
      opening = null
      throw error
    })
  return opening
}

function fileUri(path: string): string {
  return path.startsWith('file:') ? path : `file://${path}`
}

function deletePhoto(path: string): void {
  try {
    new File(fileUri(path)).delete()
  } catch (error) {
    devWarn('scanShare', `the photo is not deleted: ${errorMessage(error)}`)
  }
}

const lazyQueue: ScanQueue = {
  enqueue: async (scan, now) => (await queue()).enqueue(scan, now),
  next: async (now) => (await queue()).next(now),
  remove: async (id) => (await queue()).remove(id),
  fail: async (id, at) => (await queue()).fail(id, at),
  clear: async () => (await queue()).clear(),
}

// A build without a URL or an app key uploads nothing, and the scan is not queued either: nothing would send it.
const api = readScanApi()
const uploader =
  api === null
    ? null
    : createUploader({
        baseUrl: api.baseUrl,
        appKey: api.appKey,
        getToken: () => getToken(),
        readPhoto: (path) => new File(fileUri(path)).bytes(),
      })
const isOn = () => api !== null && shareStore.get()

const drainQueue = createDrain({
  queue: lazyQueue,
  upload: async (scan) => (uploader === null ? 'retry' : uploader.upload(scan)),
  isOn,
  noticeSeen: () => noticeStore.seen(),
  now: () => Date.now(),
  deletePhoto,
})

export const scanShare = createScanShare({
  queue,
  isOn,
  setOn: (on) => shareStore.set(on),
  contributorId,
  newId: randomUUID,
  now: () => Date.now(),
  appVersion: (Constants.expoConfig?.version ?? 'unknown').slice(0, 32),
  modelVersion: manifest.version.slice(0, 32),
  crop: (photoPath, result) => cropPhoto(skiaCodec, fileUri(photoPath), result.quad),
  writePhoto(scanId, jpeg) {
    const folder = new Directory(Paths.document, QUEUE_FOLDER)
    folder.create({ intermediates: true, idempotent: true })
    const file = new File(folder, `${scanId}.jpg`)
    file.create({ overwrite: true })
    file.write(jpeg)
    return file.uri
  },
  deletePhoto,
  markNoticeSeen: () => noticeStore.markSeen(),
  onQueued: () => noticeStore.request(),
  drainQueue,
})

export { drainQueue }
