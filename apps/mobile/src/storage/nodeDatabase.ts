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

/**
 * A SqlDatabase on the SQLite that Node 24 has built in, for Jest only: expo-sqlite is native.
 * `path` is a file, or ':memory:'. The app never imports this file.
 */
export function openNodeDatabase(path: string): NodeDatabase {
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: new (path: string) => NodeDatabaseSync
  }
  const db = new DatabaseSync(path)
  const executor: SqlExecutor = {
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
  return {
    ...executor,
    async withExclusiveTransactionAsync(task) {
      db.exec('BEGIN IMMEDIATE')
      try {
        await task(executor)
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
    close: () => db.close(),
  }
}

/** A path for a database file in the temporary folder, and a way to remove the file after the test. */
export function temporaryDatabaseFile(): { path: string; remove(): void } {
  const { tmpdir } = require('node:os') as { tmpdir(): string }
  const { join } = require('node:path') as { join(...parts: string[]): string }
  const { rmSync } = require('node:fs') as { rmSync(path: string, options: { force: boolean }): void }
  const path = join(tmpdir(), `sudoku-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
  return { path, remove: () => rmSync(path, { force: true }) }
}
