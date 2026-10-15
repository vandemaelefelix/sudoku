// The only fields a log line can hold. A new field needs a code change, so a token, a sub, an email or a body
// cannot reach the log by accident (ADR-027, F-16).
export interface LogFields {
  requestId?: string
  routeKey?: string
  status?: number
  code?: string
  userId?: string
  received?: number
  stored?: number
  noop?: number
  capped?: number
  conflicts?: number
  deletedRows?: number
  changes?: number
  more?: boolean
  durationMs?: number
  errorName?: string
}

export type Logger = (fields: LogFields) => void

const ALLOWED: readonly (keyof LogFields)[] = [
  'requestId',
  'routeKey',
  'status',
  'code',
  'userId',
  'received',
  'stored',
  'noop',
  'capped',
  'conflicts',
  'deletedRows',
  'changes',
  'more',
  'durationMs',
  'errorName',
]

// Copies only the allowed fields, also when a caller passes a wider object at run time.
export function logLine(fields: LogFields): string {
  const line: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (fields[key] !== undefined) line[key] = fields[key]
  }
  return JSON.stringify(line)
}

export const consoleLogger: Logger = (fields) => {
  console.log(logLine(fields))
}
