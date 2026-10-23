import { describe, expect, it } from 'vitest'
import { chunk, inBatches } from '../../src/deleteRows'
import { buildEntryTransaction } from '../../src/push'
import { entryWithId } from '../fixtures'

describe('chunk', () => {
  it('splits into groups of the size, with a shorter last group', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 3)).toEqual([])
  })
})

describe('inBatches', () => {
  it('runs a group at the same time and finishes it before the next group', async () => {
    const events: string[] = []
    await inBatches([1, 2, 3, 4, 5], 2, async (n) => {
      events.push(`start ${n}`)
      await Promise.resolve()
      events.push(`end ${n}`)
    })
    expect(events).toEqual([
      'start 1',
      'start 2',
      'end 1',
      'end 2',
      'start 3',
      'start 4',
      'end 3',
      'end 4',
      'start 5',
      'end 5',
    ])
  })
})

describe('buildEntryTransaction', () => {
  it('orders the items game, count, identity (the order of the cancellation reasons)', () => {
    const command = buildEntryTransaction(
      'table',
      { sub: 's', userId: 'u' },
      entryWithId(1),
      new Date('2026-10-15T09:00:00.000Z'),
    )
    const kinds = (command.input.TransactItems ?? []).map((item) => Object.keys(item)[0])
    expect(kinds).toEqual(['Put', 'Update', 'ConditionCheck'])
  })
})
