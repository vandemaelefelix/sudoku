import manifest from '@assets/models/manifest.json'
import Constants from 'expo-constants'
import { randomUUID } from 'expo-crypto'
import { kvSettings } from '@/preferences/SettingsRepository'
import { readScanApi } from './utils/scanConfig.utils'
import { cropPhoto } from './utils/cropPhoto.utils'
import { lazyQueue, openQueue } from './lazyQueue'
import { noticeStore } from './noticeStore'
import { deletePhoto, fileUri, readPhoto, writePhoto } from './photoFiles'
import { createScanShare } from './scanShare'
import { createContributorId } from './scanShareSettings'
import { shareStore } from './shareStore'
import { skiaCodec } from './skiaCodec'
import { readToken } from './tokenSource'
import { createDrain, createUploader } from './uploader'

export const contributorId = createContributorId(kvSettings, randomUUID)

// A build without a URL or an app key uploads nothing, and the scan is not queued either: nothing would send it.
const api = readScanApi()
const uploader =
  api === null
    ? null
    : createUploader({
        baseUrl: api.baseUrl,
        appKey: api.appKey,
        getToken: readToken,
        readPhoto,
      })
const isOn = () => api !== null && shareStore.get()

export const drainQueue = createDrain({
  queue: lazyQueue,
  upload: async (scan) => (uploader === null ? 'retry' : uploader.upload(scan)),
  isOn,
  noticeSeen: () => noticeStore.seen(),
  now: () => Date.now(),
  deletePhoto,
})

export const scanShare = createScanShare({
  queue: openQueue,
  isOn,
  setOn: (on) => shareStore.set(on),
  contributorId,
  newId: randomUUID,
  now: () => Date.now(),
  appVersion: (Constants.expoConfig?.version ?? 'unknown').slice(0, 32),
  modelVersion: manifest.version.slice(0, 32),
  crop: (photoPath, result) => cropPhoto(skiaCodec, fileUri(photoPath), result.quad),
  writePhoto,
  deletePhoto,
  markNoticeSeen: () => noticeStore.markSeen(),
  onQueued: () => noticeStore.request(),
  drainQueue,
})
