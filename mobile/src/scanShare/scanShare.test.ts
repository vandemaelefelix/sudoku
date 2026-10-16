import { openNodeDatabase, type NodeDatabase } from '@/storage/nodeDatabase'
import type { CellResult, RecogniseResult } from '@/scanner'
import type { CellLook } from '@/scan/utils/correction.utils'
import { createScanQueue, type ScanQueue } from './queue'
import { createScanShare, type ScanShareDeps } from './scanShare'

const UUID_SCAN = '7f3a91c2-0000-4000-8000-000000000001'
const UUID_DEVICE = '7f3a91c2-0000-4000-8000-000000000002'

const probs = (width: number, top: number) => Array.from({ length: width }, (_, i) => (i === top ? 1 : 0))
const CELL: CellResult = {
  digit: 5,
  kind: 'printed',
  confidence: 1,
  validPair: true,
  second: 0,
  digitProbs: probs(10, 5),
  kindProbs: probs(4, 1),
}
const GIVEN: CellLook = { digit: '5', style: 'given', uncertain: false }
const LOOKS = Array.from({ length: 81 }, () => GIVEN)
const quad = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.1, y: 0.9 },
] as const
const OK = {
  ok: true,
  cells: Array.from({ length: 81 }, () => CELL),
  quad: [...quad],
  corners: 'found',
  cornerOffset: null,
  timings: { imageMs: 0, detectMs: 0, flattenMs: 0, classifyMs: 0 },
} as unknown as RecogniseResult

let db: NodeDatabase
let queue: ScanQueue
let on: boolean
let deps: ScanShareDeps
let deleted: string[]
let drains: number
let queued: number
let noticeSeen: boolean

beforeEach(async () => {
  db = openNodeDatabase()
  queue = await createScanQueue(db)
  on = true
  deleted = []
  drains = 0
  queued = 0
  noticeSeen = false
  deps = {
    queue: () => Promise.resolve(queue),
    isOn: () => on,
    setOn: async (next) => {
      on = next
    },
    contributorId: async () => UUID_DEVICE,
    newId: () => UUID_SCAN,
    now: () => 1_000,
    appVersion: '1.0.0',
    modelVersion: '2.0.0',
    crop: async () => ({
      jpeg: new Uint8Array([1]),
      width: 10,
      height: 10,
      corners: [
        [0.1, 0.1],
        [0.9, 0.1],
        [0.9, 0.9],
        [0.1, 0.9],
      ],
    }),
    writePhoto: (id) => `/q/${id}.jpg`,
    deletePhoto: (path) => deleted.push(path),
    markNoticeSeen: async () => {
      noticeSeen = true
    },
    onQueued: () => {
      queued++
    },
    drainQueue: async () => {
      drains++
    },
  }
})
afterEach(() => db.close())

it('queues the record and the photo, then starts a drain', async () => {
  await createScanShare(deps).enqueueScan('/tmp/photo.jpg', OK, LOOKS)
  const item = await queue.next(1_000)
  expect(item).toMatchObject({ scanId: UUID_SCAN, photoPath: `/q/${UUID_SCAN}.jpg` })
  const record = JSON.parse(item?.record ?? '{}')
  expect(record).toMatchObject({ scanId: UUID_SCAN, contributorId: UUID_DEVICE, modelVersion: '2.0.0' })
  expect(record.cells).toHaveLength(81)
  expect(drains).toBe(1)
  expect(queued).toBe(1)
})

it('does nothing when sharing is off', async () => {
  on = false
  const crop = jest.fn(deps.crop)
  await createScanShare({ ...deps, crop }).enqueueScan('/tmp/photo.jpg', OK, LOOKS)
  expect(crop).not.toHaveBeenCalled()
  expect(await queue.next(1_000)).toBeNull()
  expect(drains).toBe(0)
})

it('does nothing for a failed scan or a scan without a photo', async () => {
  const share = createScanShare(deps)
  await share.enqueueScan('/tmp/photo.jpg', { ok: false, reason: 'no grid' }, LOOKS)
  await share.enqueueScan(undefined, OK, LOOKS)
  expect(await queue.next(1_000)).toBeNull()
})

const failingCrop = async () => {
  throw new Error('no surface')
}

it('never throws when the crop fails', async () => {
  await expect(
    createScanShare({ ...deps, crop: failingCrop }).enqueueScan('/tmp/photo.jpg', OK, LOOKS),
  ).resolves.toBeUndefined()
  expect(await queue.next(1_000)).toBeNull()
})

const turnOffThenCrop: ScanShareDeps['crop'] = async (path, result) => {
  on = false
  return deps.crop(path, result)
}

it('queues nothing when the player turns sharing off during the crop', async () => {
  await createScanShare({ ...deps, crop: turnOffThenCrop }).enqueueScan('/tmp/photo.jpg', OK, LOOKS)
  expect(await queue.next(1_000)).toBeNull()
})

it('clears the queue and deletes the photos when the player turns sharing off', async () => {
  const share = createScanShare(deps)
  await share.enqueueScan('/tmp/photo.jpg', OK, LOOKS)
  await share.setShareScans(false)
  expect(on).toBe(false)
  expect(await queue.next(1_000)).toBeNull()
  expect(deleted).toEqual([`/q/${UUID_SCAN}.jpg`])
})

it('keeps the queue when the player turns sharing on', async () => {
  const share = createScanShare(deps)
  await share.enqueueScan('/tmp/photo.jpg', OK, LOOKS)
  await share.setShareScans(true)
  expect(await queue.next(1_000)).not.toBeNull()
})

describe('first-upload notice', () => {
  it('"Got it" saves the flag and starts a drain', async () => {
    await createScanShare(deps).acceptNotice()
    expect(noticeSeen).toBe(true)
    expect(on).toBe(true)
    expect(drains).toBe(1)
  })

  it('"Turn off" switches sharing off, clears the queue and saves the flag', async () => {
    const share = createScanShare(deps)
    await share.enqueueScan('/tmp/photo.jpg', OK, LOOKS)
    await share.declineNotice()
    expect(on).toBe(false)
    expect(noticeSeen).toBe(true)
    expect(await queue.next(1_000)).toBeNull()
    expect(deleted).toEqual([`/q/${UUID_SCAN}.jpg`])
  })
})
