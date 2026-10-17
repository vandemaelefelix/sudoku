import assert from 'node:assert/strict'
import { test } from 'node:test'

import { deleteScans } from './delete-scans.ts'

function fakes(rows) {
  const deleted = { photos: [], rows: [] }
  const db = {
    async scanSortKeys(pk) {
      return (rows[pk] ?? []).filter((sk) => sk.startsWith('SCAN#'))
    },
    async deleteRow(pk, sk) {
      deleted.rows.push([pk, sk])
    },
  }
  const photos = {
    async delete(key) {
      deleted.photos.push(key)
    },
  }
  return { db, photos, deleted }
}

test('deletes only the scans of the owner', async () => {
  const { db, photos, deleted } = fakes({
    'CONTRIB#c1': ['SCAN#a', 'SCAN#b'],
    'CONTRIB#c2': ['SCAN#z'],
    'USER#c1': ['GAME#g', 'SCAN#u'],
  })
  const result = await deleteScans({ db, photos, owner: 'c1', confirm: async () => true })
  assert.deepEqual(result, { found: 3, deleted: 3 })
  assert.deepEqual(deleted.photos.toSorted(), ['scans/a.jpg', 'scans/b.jpg', 'scans/u.jpg'])
  assert.deepEqual(deleted.rows.map((r) => r[1]).toSorted(), ['SCAN#a', 'SCAN#b', 'SCAN#u'])
})

test('deletes nothing when the player answers no', async () => {
  const { db, photos, deleted } = fakes({ 'CONTRIB#c1': ['SCAN#a'] })
  const result = await deleteScans({ db, photos, owner: 'c1', confirm: async () => false })
  assert.deepEqual(result, { found: 1, deleted: 0 })
  assert.deepEqual(deleted, { photos: [], rows: [] })
})

test('does not ask when the owner has no scans', async () => {
  const { db, photos } = fakes({})
  let asked = false
  const result = await deleteScans({ db, photos, owner: 'c1', confirm: async () => ((asked = true), true) })
  assert.deepEqual(result, { found: 0, deleted: 0 })
  assert.equal(asked, false)
})

test('deletes the photo before the row', async () => {
  const order = []
  const db = {
    scanSortKeys: async (pk) => (pk.startsWith('CONTRIB#') ? ['SCAN#a'] : []),
    deleteRow: async () => order.push('row'),
  }
  const photos = { delete: async () => order.push('photo') }
  await deleteScans({ db, photos, owner: 'x', confirm: async () => true })
  assert.deepEqual(order, ['photo', 'row'])
})
