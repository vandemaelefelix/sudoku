// The smoke test of the sync API on a deployed stage. Run it with: just smoke-api felix <clerk user id>
// It reads CLERK_SECRET_KEY from the shell and never prints a token.
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { apiUrlFrom, assertSmokeAllowed, report, type CheckResult } from './smokeChecks.ts'

const CLERK_API = 'https://api.clerk.com/v1'
const TEMPLATE = 'sudoku-api'
const THROTTLE_REQUESTS = 15

const [stage = '', userId = ''] = process.argv.slice(2)
const secretKey = process.env.CLERK_SECRET_KEY
assertSmokeAllowed(stage, secretKey)
if (!userId.startsWith('user_')) throw new Error('Pass the Clerk user ID of the smoke user (user_...).')

const outputsPath = new URL('../../../.sst/outputs.json', import.meta.url)
const outputs: unknown = existsSync(outputsPath) ? JSON.parse(readFileSync(outputsPath, 'utf8')) : null
const syncUrl = `${apiUrlFrom(outputs)}/v1/sync`

async function clerk(path: string, body: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const response = await fetch(`${CLERK_API}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${secretKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`Clerk ${path.split('/')[1]} call failed with ${response.status}.`)
  return (await response.json()) as Record<string, unknown>
}

// A template token lives 60 seconds, so every check asks for a new one.
async function token(sessionId: string, template?: string): Promise<string> {
  const path = template ? `/sessions/${sessionId}/tokens/${template}` : `/sessions/${sessionId}/tokens`
  return String((await clerk(path)).jwt)
}

async function callSync(body: unknown, bearer?: string): Promise<{ status: number; json: Record<string, unknown> }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (bearer) headers.authorization = `Bearer ${bearer}`
  const response = await fetch(syncUrl, { method: 'POST', headers, body: JSON.stringify(body) })
  const text = await response.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    // A 429 from API Gateway can have a body that is not JSON. The check reads only the status.
  }
  return { status: response.status, json }
}

const session = await clerk('/sessions', { user_id: userId })
const sessionId = String(session.id)
const results: CheckResult[] = []
const check = (name: string, ok: boolean, detail: string) => results.push({ name, ok, detail })

try {
  const now = new Date().toISOString()
  const entry = {
    schemaVersion: 1,
    id: randomUUID(),
    level: 'easy',
    source: 'generated',
    result: 'won',
    seed: 1,
    playedMs: 60_000,
    mistakes: 0,
    hintsUsed: 0,
    finishedAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }

  const noToken = await callSync({ entries: [], cursor: null })
  check('no token -> 401', noToken.status === 401, String(noToken.status))

  const plain = await callSync({ entries: [], cursor: null }, await token(sessionId))
  check('session token without the template (no aud) -> 401', plain.status === 401, String(plain.status))

  const empty = await callSync({ entries: [], cursor: null }, await token(sessionId, TEMPLATE))
  check('empty sync -> 200', empty.status === 200, String(empty.status))

  const first = await callSync({ entries: [entry], cursor: null }, await token(sessionId, TEMPLATE))
  const firstIds = (first.json.acceptedIds as string[] | undefined) ?? []
  const firstChanges = (first.json.changes as { id: string }[] | undefined) ?? []
  check(
    'one entry -> 200, accepted and in changes',
    first.status === 200 && firstIds.includes(entry.id) && firstChanges.some((c) => c.id === entry.id),
    String(first.status),
  )

  const again = await callSync({ entries: [entry], cursor: first.json.cursor }, await token(sessionId, TEMPLATE))
  const againChanges = (again.json.changes as { id: string }[] | undefined) ?? []
  check(
    'same entry with the new cursor -> accepted again and back in changes (overlap)',
    again.status === 200 && againChanges.some((c) => c.id === entry.id),
    String(again.status),
  )

  const badCursor = await callSync({ entries: [], cursor: 'not-a-cursor' }, await token(sessionId, TEMPLATE))
  check(
    'bad cursor -> 400 invalid_cursor',
    badCursor.status === 400 && badCursor.json.code === 'invalid_cursor',
    String(badCursor.status),
  )

  const bearer = await token(sessionId, TEMPLATE)
  const burst = await Promise.all(
    Array.from({ length: THROTTLE_REQUESTS }, () => callSync({ entries: [], cursor: null }, bearer)),
  )
  const throttled = burst.filter((r) => r.status === 429).length
  check(`${THROTTLE_REQUESTS} fast requests -> at least one 429`, throttled > 0, `${throttled} x 429`)
} finally {
  await clerk(`/sessions/${sessionId}/revoke`)
}

const { text, passed } = report(results)
console.log(text)
process.exitCode = passed ? 0 : 1
