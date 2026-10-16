import { describe, expect, it, vi } from 'vitest'
import { turnOn, type TurnOnDeps } from '../../src/turnOn.ts'

const throttle = { throttlingRateLimit: 1, throttlingBurstLimit: 10 }

function makeDeps(overrides: Partial<TurnOnDeps> = {}) {
  const calls: string[] = []
  const deps: TurnOnDeps = {
    findApis: vi.fn<TurnOnDeps['findApis']>(async () => ['api-1']),
    findFunctions: vi.fn<TurnOnDeps['findFunctions']>(async () => ['fn-1']),
    startApi: vi.fn<TurnOnDeps['startApi']>(async (id) => void calls.push(`api:${id}`)),
    startFunction: vi.fn<TurnOnDeps['startFunction']>(async (name) => void calls.push(`fn:${name}`)),
    clearFlag: vi.fn<TurnOnDeps['clearFlag']>(async (stage) => void calls.push(`clear:${stage}`)),
    ...overrides,
  }
  return { deps, calls }
}

describe('turnOn', () => {
  it('restores the throttle and the concurrency, then clears the flag last', async () => {
    const { deps, calls } = makeDeps()
    await turnOn(deps, 'felix', throttle)
    expect(calls).toEqual(['api:api-1', 'fn:fn-1', 'clear:felix'])
    expect(deps.startApi).toHaveBeenCalledWith('api-1', throttle)
  })

  it('keeps the flag when a step fails', async () => {
    const { deps, calls } = makeDeps({
      startFunction: vi.fn<TurnOnDeps['startFunction']>(async () => {
        throw new Error('denied')
      }),
    })
    await expect(turnOn(deps, 'felix', throttle)).rejects.toThrow(/denied/)
    expect(calls).not.toContain('clear:felix')
  })

  it('clears the flag of a stage that holds nothing yet', async () => {
    const { deps, calls } = makeDeps({
      findApis: vi.fn<TurnOnDeps['findApis']>(async () => []),
      findFunctions: vi.fn<TurnOnDeps['findFunctions']>(async () => []),
    })
    await turnOn(deps, 'dev', throttle)
    expect(calls).toEqual(['clear:dev'])
  })
})
