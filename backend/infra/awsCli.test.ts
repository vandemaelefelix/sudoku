import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { AWS_PROFILE, profileArgs } from './awsCli.ts'

describe('profileArgs', () => {
  it('uses the profile sudoku on the laptop', () => {
    assert.deepEqual(profileArgs(false), ['--profile', 'sudoku'])
    assert.equal(AWS_PROFILE, 'sudoku')
  })

  it('uses no profile in CI, where the role credentials come from the environment', () => {
    assert.deepEqual(profileArgs(true), [])
  })
})
