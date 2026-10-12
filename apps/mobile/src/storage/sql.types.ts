export type SqlValue = string | number | null

/** The part of an expo-sqlite database that the repositories use. Values go in as `?` parameters, never into the SQL text. */
export type SqlExecutor = {
  execAsync(source: string): Promise<void>
  runAsync(source: string, params: SqlValue[]): Promise<{ changes: number }>
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>
}

export type SqlDatabase = SqlExecutor & {
  /** Only the statements on `txn` belong to the transaction. A throw in `task` rolls it back. */
  withExclusiveTransactionAsync(task: (txn: SqlExecutor) => Promise<void>): Promise<void>
}
