import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

function FakeFunction() {}
type Args = Record<string, unknown>
const root = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')

// Runs backend/infra/defaults.ts with a fake $transform and returns the callback that SST would run for each function.
async function loadTransform(): Promise<(args: Args) => void> {
  let registered: ((args: Args) => void) | undefined
  const globals = globalThis as Record<string, unknown>
  globals.sst = { aws: { Function: FakeFunction } }
  globals.$transform = (_type: unknown, callback: (args: Args) => void) => {
    registered = callback
  }
  await import(`./defaults.ts?run=${Math.random()}`)
  assert.ok(registered, 'defaults.ts registers no $transform')
  return registered
}

describe('function defaults (ADR-027 decision 3)', () => {
  it('give an empty function the project values, not the SST values', async () => {
    const args: Args = {}
    ;(await loadTransform())(args)
    assert.equal(args.runtime, 'nodejs24.x')
    assert.equal(args.architecture, 'arm64')
    assert.equal(args.memory, '512 MB')
    assert.equal(args.timeout, '10 seconds')
    assert.deepEqual(args.logging, { retention: '1 month' })
  })

  it('keep a value that a function sets itself', async () => {
    const args: Args = { memory: '1024 MB', logging: false }
    ;(await loadTransform())(args)
    assert.equal(args.memory, '1024 MB')
    assert.equal(args.logging, false)
  })

  it('are registered before the first function is created', () => {
    const source = root('sst.config.ts')
    const defaults = source.indexOf("import('./backend/infra/defaults.ts')")
    for (const file of ['storage', 'api', 'clerk', 'budget']) {
      const index = source.indexOf(`import('./backend/infra/${file}.ts')`)
      assert.ok(defaults >= 0 && defaults < index, `defaults.ts must come before ${file}.ts`)
    }
  })

  // The 30 s timeout is the intended exception: the delete route removes every row of a player (ADR-027 amendment).
  it('are overridden by the sync function only for the timeout', () => {
    const block = /new sst\.aws\.Function\('SyncApiFunction', \{([^}]*)\}/.exec(root('backend/infra/api.ts'))
    assert.ok(block)
    assert.doesNotMatch(block[1] ?? '', /runtime|architecture|memory|logging/)
    assert.match(block[1] ?? '', /timeout: '30 seconds'/)
  })
})
