import type { SqlExecutor } from '@/storage/sql.types'

export type QueuedScan = {
  scanId: string
  /** The scan record as JSON. */
  record: string
  /** The cropped JPEG file. */
  photoPath: string
  attempts: number
}

type Row = { scan_id: string; record: string; photo_path: string; attempts: number }

export type ScanQueue = {
  enqueue(scan: Omit<QueuedScan, 'attempts'>, now: number): Promise<void>
  /** The oldest scan that is due at `now`, or null. */
  next(now: number): Promise<QueuedScan | null>
  remove(scanId: string): Promise<void>
  /** Counts a failed try and holds the scan until `retryAt` (milliseconds since the epoch). */
  fail(scanId: string, retryAt: number): Promise<void>
  /** Removes every row. Returns the photo paths, for the caller to delete. */
  clear(): Promise<string[]>
}

const SCHEMA = `CREATE TABLE IF NOT EXISTS scan_queue (
  scan_id TEXT PRIMARY KEY NOT NULL,
  record TEXT NOT NULL,
  photo_path TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  retry_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);`

const toScan = (row: Row): QueuedScan => ({
  scanId: row.scan_id,
  record: row.record,
  photoPath: row.photo_path,
  attempts: row.attempts,
})

/**
 * The upload queue (SUD-01). It lives in its own database file, so a scan that waits for days never touches the game storage.
 * A row stays until the server takes the scan or rejects it.
 */
export async function createScanQueue(db: SqlExecutor): Promise<ScanQueue> {
  await db.execAsync(SCHEMA)
  return {
    async enqueue(scan, now) {
      await db.runAsync(
        'INSERT OR IGNORE INTO scan_queue (scan_id, record, photo_path, attempts, retry_at, created_at) VALUES (?, ?, ?, 0, ?, ?)',
        [scan.scanId, scan.record, scan.photoPath, now, now],
      )
    },
    async next(now) {
      const row = await db.getFirstAsync<Row>(
        'SELECT scan_id, record, photo_path, attempts FROM scan_queue WHERE retry_at <= ? ORDER BY created_at, rowid LIMIT 1',
        [now],
      )
      return row === null ? null : toScan(row)
    },
    async remove(scanId) {
      await db.runAsync('DELETE FROM scan_queue WHERE scan_id = ?', [scanId])
    },
    async fail(scanId, retryAt) {
      await db.runAsync('UPDATE scan_queue SET attempts = attempts + 1, retry_at = ? WHERE scan_id = ?', [
        retryAt,
        scanId,
      ])
    },
    async clear() {
      const rows = await db.getAllAsync<{ photo_path: string }>('SELECT photo_path FROM scan_queue', [])
      await db.runAsync('DELETE FROM scan_queue', [])
      return rows.map((row) => row.photo_path)
    },
  }
}
