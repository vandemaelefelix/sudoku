import type { SqlDatabase, SqlExecutor, SqlValue } from './sql.types'

type NodeStatement = {
  run(...params: SqlValue[]): { changes: number | bigint }
  get(...params: SqlValue[]): unknown
  all(...params: SqlValue[]): unknown[]
}

type NodeDatabaseSync = {
  exec(source: string): void
  prepare(source: string): NodeStatement
  close(): void
}

export type NodeDatabase = SqlDatabase & { close(): void }

function connect(path: string): NodeDatabaseSync {
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: new (path: string, options: { timeout: number }) => NodeDatabaseSync
  }
  // expo-sqlite 57 sets no busy timeout: a second writer fails at once with "database is locked".
  return new DatabaseSync(path, { timeout: 0 })
}

function executorOf(db: NodeDatabaseSync): SqlExecutor {
  return {
    async execAsync(source) {
      db.exec(source)
    },
    async runAsync(source, params) {
      return { changes: Number(db.prepare(source).run(...params).changes) }
    },
    async getFirstAsync<T>(source: string, params: SqlValue[]) {
      return (db.prepare(source).get(...params) as T | undefined) ?? null
    },
    async getAllAsync<T>(source: string, params: SqlValue[]) {
      return db.prepare(source).all(...params) as T[]
    },
  }
}

/**
 * A SqlDatabase on the SQLite that Node 24 has built in, for Jest only: expo-sqlite is native.
 * It acts as expo-sqlite 57 with openStorage: a file in WAL mode, and each transaction a plain BEGIN
 * on a second connection. Without `path`, it uses a temporary file and removes it on close.
 * The app never imports this file.
 */
export function openNodeDatabase(path?: string): NodeDatabase {
  const temporary = path === undefined ? temporaryDatabaseFile() : null
  const file = path ?? temporary?.path ?? ''
  const db = connect(file)
  db.exec('PRAGMA journal_mode = WAL')
  return {
    ...executorOf(db),
    async withExclusiveTransactionAsync(task) {
      const connection = connect(file)
      try {
        connection.exec('BEGIN')
        try {
          await task(executorOf(connection))
          connection.exec('COMMIT')
        } catch (error) {
          connection.exec('ROLLBACK')
          throw error
        }
      } finally {
        connection.close()
      }
    },
    close: () => {
      db.close()
      temporary?.remove()
    },
  }
}

/** A path for a database file in the temporary folder, and a way to remove the file and its WAL files. */
export function temporaryDatabaseFile(): { path: string; remove(): void } {
  const { tmpdir } = require('node:os') as { tmpdir(): string }
  const { join } = require('node:path') as { join(...parts: string[]): string }
  const { rmSync } = require('node:fs') as { rmSync(path: string, options: { force: boolean }): void }
  const path = join(tmpdir(), `sudoku-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
  return {
    path,
    remove: () => {
      for (const suffix of ['', '-wal', '-shm']) rmSync(`${path}${suffix}`, { force: true })
    },
  }
}
