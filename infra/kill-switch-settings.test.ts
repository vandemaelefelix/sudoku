import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { STAGE_THROTTLE } from './backend-settings.ts'
import {
  flagIsSet,
  parseApiOnArgs,
  killSwitchFlagName,
  killSwitchVerdict,
  guardApplies,
  stoppedMessage,
} from './kill-switch-settings.ts'

describe('killSwitchFlagName', () => {
  it('names one SSM parameter per stage', () => {
    assert.equal(killSwitchFlagName('felix'), '/sudoku/kill-switch/felix')
  })
})

describe('killSwitchVerdict', () => {
  it('allows a deploy when the flag does not exist', () => {
    const verdict = killSwitchVerdict('felix', {
      ok: false,
      stderr: 'An error occurred (ParameterNotFound) when calling',
    })
    assert.deepEqual(verdict, { allow: true })
  })

  it('allows a deploy on the real CLI error of a missing parameter', () => {
    const stderr =
      '\nAn error occurred (ParameterNotFound) when calling the GetParameter operation: ' +
      'Parameter /sudoku/kill-switch/felix not found.\n'
    assert.deepEqual(killSwitchVerdict('felix', { ok: false, stderr }), { allow: true })
  })

  it('refuses a deploy when the error only mentions the words', () => {
    const verdict = killSwitchVerdict('felix', {
      ok: false,
      stderr: 'AccessDeniedException: ParameterNotFound not shown',
    })
    assert.equal(verdict.allow, false)
  })

  it('guards deploy and dev, and lets remove and diff pass', () => {
    assert.equal(guardApplies('deploy'), true)
    assert.equal(guardApplies('dev'), true)
    assert.equal(guardApplies('remove'), false)
    assert.equal(guardApplies('diff'), false)
  })

  it('refuses a deploy when the flag exists, and names the time and the command', () => {
    const verdict = killSwitchVerdict('felix', {
      ok: true,
      stdout: JSON.stringify({ at: '2026-10-20T10:00:00.000Z', reason: 'budget' }),
    })
    assert.equal(verdict.allow, false)
    assert.match((verdict as { message: string }).message, /2026-10-20T10:00:00\.000Z/)
    assert.match((verdict as { message: string }).message, /just api-on felix/)
  })

  it('refuses a flag whose value it cannot read', () => {
    const verdict = killSwitchVerdict('felix', { ok: true, stdout: 'not json' })
    assert.equal(verdict.allow, false)
  })

  it('refuses when the check itself fails, so a broken check never deploys', () => {
    const verdict = killSwitchVerdict('felix', { ok: false, stderr: 'AccessDeniedException' })
    assert.equal(verdict.allow, false)
    assert.match((verdict as { message: string }).message, /AccessDeniedException/)
  })
})

describe('flagIsSet', () => {
  it('finds the flag of the stage in a list of parameter names', () => {
    const names = ['/sudoku/kill-switch/dev', '/sudoku/kill-switch/felix']
    assert.equal(flagIsSet(names, 'felix'), true)
    assert.equal(flagIsSet(names, 'production'), false)
    assert.equal(flagIsSet([], 'felix'), false)
  })
})

describe('stoppedMessage', () => {
  it('tells the developer to check the bill first', () => {
    assert.match(stoppedMessage('dev', 'at 10:00'), /Check the bill/)
  })
})

describe('the stage throttle', () => {
  it('is the value that api-on restores', () => {
    assert.deepEqual(STAGE_THROTTLE, { throttlingRateLimit: 1, throttlingBurstLimit: 10 })
  })
})

describe('parseApiOnArgs', () => {
  it('reads the stage and asks for confirmation by default', () => {
    assert.deepEqual(parseApiOnArgs(['felix']), { stage: 'felix', yes: false })
  })

  it('skips the confirmation with --yes in any position', () => {
    assert.deepEqual(parseApiOnArgs(['--yes', 'dev']), { stage: 'dev', yes: true })
  })

  it('rejects an unknown stage, a missing stage and an unknown flag', () => {
    assert.throws(() => parseApiOnArgs(['staging']), /Unknown stage/)
    assert.throws(() => parseApiOnArgs([]), /Unknown stage/)
    assert.throws(() => parseApiOnArgs(['felix', '--force']), /Unknown option/)
  })
})
