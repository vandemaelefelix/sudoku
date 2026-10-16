/** Runs a write task after the task before it. Fails a task alone: the next task still runs. */
export type WriteQueue = <T>(task: () => Promise<T>) => Promise<T>

/**
 * One queue per connection, shared by every repository on it (ADR-012). Two exclusive transactions on one
 * connection must not overlap. expo-sqlite sets no busy timeout, so a write that meets an open exclusive
 * transaction fails at once with "database is locked".
 */
export function createWriteQueue(): WriteQueue {
  let last: Promise<unknown> = Promise.resolve()
  return <T>(task: () => Promise<T>): Promise<T> => {
    const next = last.then(task, task)
    last = next.catch(() => undefined)
    return next
  }
}
