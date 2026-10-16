import assert from 'node:assert/strict'
import { test } from 'node:test'

import { unexpectedEntries } from './check-layout.mjs'

test('accepts the folders and files of ADR-029', () => {
  const paths = ['mobile/App.tsx', 'ml/README.md', 'backend/api/src/handler.ts', 'web/build.mjs', 'justfile']
  assert.deepEqual(unexpectedEntries(paths), [])
})

test('reports a folder that the ADR does not list', () => {
  assert.deepEqual(unexpectedEntries(['apps/mobile/App.tsx', 'mobile/App.tsx']), ['apps'])
})

test('reports a stray root file', () => {
  assert.deepEqual(unexpectedEntries(['notes.txt']), ['notes.txt'])
})

test('reports each entry once, in sorted order', () => {
  assert.deepEqual(unexpectedEntries(['zeta/a', 'zeta/b', 'alpha/c']), ['alpha', 'zeta'])
})
