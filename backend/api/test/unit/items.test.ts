import { describe, expect, it } from 'vitest'
import { fromGameItem, toGameItem } from '../../src/items'
import { validEntry } from '../fixtures'

const SYNCED_AT = '2026-10-15T10:00:00.000Z'

describe('toGameItem', () => {
  it('keys the row by the player and the id, stamps syncedAt and stores no id attribute', () => {
    const entry = validEntry()
    const { id, ...fields } = entry
    expect(toGameItem('u-1', entry, SYNCED_AT)).toEqual({
      pk: 'USER#u-1',
      sk: `GAME#${id}`,
      ...fields,
      syncedAt: SYNCED_AT,
    })
  })
})

describe('fromGameItem', () => {
  it('gives back the entry', () => {
    const entry = validEntry({ seed: null, deletedAt: '2026-10-15T11:00:00.000Z' })
    expect(fromGameItem(toGameItem('u-1', entry, SYNCED_AT))).toEqual(entry)
  })

  it('never sends the server fields on the wire', () => {
    const wire = fromGameItem({ ...toGameItem('u-1', validEntry(), SYNCED_AT), expiresAt: 1 })
    for (const key of ['pk', 'sk', 'syncedAt', 'expiresAt']) expect(wire).not.toHaveProperty(key)
  })
})
