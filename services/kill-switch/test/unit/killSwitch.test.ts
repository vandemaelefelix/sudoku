import { describe, expect, it, vi } from 'vitest'
import { killSwitch, type KillSwitchDeps } from '../../src/killSwitch.ts'

function makeDeps(overrides: Partial<KillSwitchDeps> = {}) {
  const calls: string[] = []
  const deps: KillSwitchDeps = {
    setFlag: vi.fn<KillSwitchDeps['setFlag']>(async (stage) => void calls.push(`flag:${stage}`)),
    findApis: vi.fn<KillSwitchDeps['findApis']>(async (stage) => (stage === 'felix' ? ['api-felix'] : [])),
    findFunctions: vi.fn<KillSwitchDeps['findFunctions']>(async (stage) => (stage === 'felix' ? ['fn-felix'] : [])),
    stopApi: vi.fn<KillSwitchDeps['stopApi']>(async (id) => void calls.push(`api:${id}`)),
    stopFunction: vi.fn<KillSwitchDeps['stopFunction']>(async (name) => void calls.push(`fn:${name}`)),
    notify: vi.fn<KillSwitchDeps['notify']>(async () => {}),
    now: () => new Date('2026-10-20T10:00:00Z'),
    ...overrides,
  }
  return { deps, calls }
}

describe('killSwitch', () => {
  it('stops every stage, and flags a stage that holds nothing yet', async () => {
    const { deps, calls } = makeDeps()
    await killSwitch(deps, ['felix', 'dev', 'production'])
    expect(calls).toEqual(['flag:felix', 'api:api-felix', 'fn:fn-felix', 'flag:dev', 'flag:production'])
  })

  it('sets the flag before it stops anything, so a half-failed stop still blocks deploys', async () => {
    const { deps, calls } = makeDeps()
    await killSwitch(deps, ['felix'])
    expect(calls[0]).toBe('flag:felix')
  })

  it('writes the time and the reason into the flag', async () => {
    const { deps } = makeDeps()
    await killSwitch(deps, ['dev'])
    expect(deps.setFlag).toHaveBeenCalledWith('dev', { at: '2026-10-20T10:00:00.000Z', reason: 'budget' })
  })

  it('keeps going after a failure, emails it, and throws so SNS retries', async () => {
    const { deps, calls } = makeDeps({
      stopApi: vi.fn<KillSwitchDeps['stopApi']>(async () => {
        throw new Error('AccessDenied')
      }),
    })
    await expect(killSwitch(deps, ['felix', 'dev'])).rejects.toThrow(/felix/)
    expect(calls).toContain('fn:fn-felix')
    expect(calls).toContain('flag:dev')
    const [subject, body] = vi.mocked(deps.notify).mock.calls[0]!
    expect(subject).toMatch(/failed/i)
    expect(body).toContain('AccessDenied')
    expect(body).toContain('dev')
  })

  it('still tries the stop when the flag fails', async () => {
    const { deps, calls } = makeDeps({
      setFlag: vi.fn<KillSwitchDeps['setFlag']>(async () => {
        throw new Error('flag down')
      }),
    })
    await expect(killSwitch(deps, ['felix'])).rejects.toThrow(/felix/)
    expect(calls).toEqual(['api:api-felix', 'fn:fn-felix'])
  })

  it('sends one summary email on success', async () => {
    const { deps } = makeDeps()
    await killSwitch(deps, ['felix', 'dev'])
    expect(deps.notify).toHaveBeenCalledTimes(1)
    const [subject, body] = vi.mocked(deps.notify).mock.calls[0]!
    expect(subject).toMatch(/stopped/i)
    expect(body).toContain('felix')
    expect(body).toContain('just api-on')
  })

  it('makes the same calls when it runs again', async () => {
    const first = makeDeps()
    const second = makeDeps()
    await killSwitch(first.deps, ['felix'])
    await killSwitch(second.deps, ['felix'])
    await killSwitch(second.deps, ['felix'])
    expect(second.calls).toEqual([...first.calls, ...first.calls])
  })

  it('reports a failed lookup as a failure', async () => {
    const { deps } = makeDeps({
      findFunctions: vi.fn<KillSwitchDeps['findFunctions']>(async () => {
        throw new Error('list failed')
      }),
    })
    await expect(killSwitch(deps, ['felix'])).rejects.toThrow(/felix/)
  })
})
