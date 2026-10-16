import { openNodeDatabase, type NodeDatabase } from '@/storage/nodeDatabase'
import { createScanQueue, type ScanQueue } from './queue'

let db: NodeDatabase
let queue: ScanQueue

beforeEach(async () => {
  db = openNodeDatabase()
  queue = await createScanQueue(db)
})
afterEach(() => db.close())

const scan = (id: string) => ({ scanId: id, record: `{"id":"${id}"}`, photoPath: `/q/${id}.jpg` })

it('hands out the oldest scan first and removes a row after success', async () => {
  await queue.enqueue(scan('a'), 10)
  await queue.enqueue(scan('b'), 20)
  expect((await queue.next(100))?.scanId).toBe('a')
  await queue.remove('a')
  expect((await queue.next(100))?.scanId).toBe('b')
  await queue.remove('b')
  expect(await queue.next(100)).toBeNull()
})

it('keeps the queue in the file: a new queue on the same database sees the scans', async () => {
  await queue.enqueue(scan('a'), 10)
  const again = await createScanQueue(db)
  expect((await again.next(100))?.scanId).toBe('a')
})

it('holds a failed scan until its retry time and counts the try', async () => {
  await queue.enqueue(scan('a'), 10)
  await queue.fail('a', 500)
  expect(await queue.next(499)).toBeNull()
  expect(await queue.next(500)).toMatchObject({ scanId: 'a', attempts: 1 })
})

it('does not add a scan twice', async () => {
  await queue.enqueue(scan('a'), 10)
  await queue.enqueue(scan('a'), 20)
  await queue.remove('a')
  expect(await queue.next(100)).toBeNull()
})

it('clears every row and returns the photo paths', async () => {
  await queue.enqueue(scan('a'), 10)
  await queue.enqueue(scan('b'), 20)
  expect((await queue.clear()).toSorted()).toEqual(['/q/a.jpg', '/q/b.jpg'])
  expect(await queue.next(100)).toBeNull()
})
