import assert from 'node:assert/strict'
import { test } from 'node:test'
import plugin from './sudoku-plugin.mjs'

function reports(node) {
  const found = []
  const visitors = plugin.rules['no-constant-text'].create({ report: (r) => found.push(r) })
  visitors[node.type](node)
  return found.length
}
const literal = (value) => ({ type: 'Literal', value })
const template = (...cooked) => ({ type: 'TemplateLiteral', quasis: cooked.map((c) => ({ value: { cooked: c } })) })

test('refuses a sentence in a constants file', () => {
  for (const value of ['Add games', 'Not now', 'Start a new game?', 'Ga verder', 'Égal à']) {
    assert.equal(reports(literal(value)), 1, value)
  }
  assert.equal(reports(template('Version ', '')), 1)
})

test('keeps keys, ids, units and single words', () => {
  for (const value of [
    'app.language',
    'settings.language.title',
    'x-app-key',
    'Bearer',
    'Content-Type',
    'sudoku-api',
    '–',
    'en-GB',
    '',
    42,
  ]) {
    assert.equal(reports(literal(value)), 0, String(value))
  }
})
