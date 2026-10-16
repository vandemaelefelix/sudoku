import { describe, expect, it } from 'vitest'
import { logLine, type LogFields } from '../../src/log'

describe('logLine', () => {
  it('writes the allowed fields as one JSON line', () => {
    expect(JSON.parse(logLine({ requestId: 'r-1', status: 200, stored: 2, more: false }))).toEqual({
      requestId: 'r-1',
      status: 200,
      stored: 2,
      more: false,
    })
  })

  it('drops every field that is not on the allow-list', () => {
    const wider = { status: 401, sub: 'user_abc', email: 'a@b.c', authorization: 'Bearer x' } as LogFields
    expect(JSON.parse(logLine(wider))).toEqual({ status: 401 })
  })

  it('keeps the conflicts count', () => {
    expect(JSON.parse(logLine({ conflicts: 2 }))).toEqual({ conflicts: 2 })
  })
})

describe('logLine, delete account', () => {
  it('keeps the deleted rows count', () => {
    expect(JSON.parse(logLine({ deletedRows: 3 }))).toEqual({ deletedRows: 3 })
  })
})
