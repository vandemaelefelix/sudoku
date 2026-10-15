import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { accountProblem, callerAccountArgs, isStage } from './account.ts'

describe('accountProblem', () => {
  it('accepts the expected account', () => {
    assert.equal(accountProblem('779846813799', '779846813799'), null)
  })

  it('names both accounts when they differ', () => {
    const problem = accountProblem('111111111111', '779846813799')
    assert.ok(problem)
    assert.match(problem, /111111111111/)
    assert.match(problem, /779846813799/)
    assert.match(problem, /aws login --profile sudoku-login/)
  })

  it('refuses an expected account that is not 12 digits', () => {
    assert.ok(accountProblem('<12 digits>', '<12 digits>'))
    assert.ok(accountProblem('12345', '12345'))
  })
})

describe('isStage', () => {
  it('accepts the three stages', () => {
    for (const stage of ['felix', 'dev', 'production']) assert.equal(isStage(stage), true)
  })

  it('refuses other names', () => {
    assert.equal(isStage('prod'), false)
    assert.equal(isStage(''), false)
  })
})

describe('callerAccountArgs', () => {
  it('uses the profile sudoku on the laptop', () => {
    assert.deepEqual(callerAccountArgs(false).slice(0, 4), ['sts', 'get-caller-identity', '--profile', 'sudoku'])
  })

  it('uses the ambient role credentials in CI', () => {
    assert.ok(!callerAccountArgs(true).includes('--profile'))
  })
})
