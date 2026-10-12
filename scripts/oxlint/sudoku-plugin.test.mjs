import assert from 'node:assert/strict'
import { test } from 'node:test'
import plugin from './sudoku-plugin.mjs'

function reports(node) {
  const found = []
  const visitors = plugin.rules['no-colour-literal'].create({ report: (r) => found.push(r) })
  visitors[node.type](node)
  return found.length
}
const literal = (value) => ({ type: 'Literal', value })
const template = (...cooked) => ({ type: 'TemplateLiteral', quasis: cooked.map((c) => ({ value: { cooked: c } })) })

test('refuses every colour form', () => {
  for (const value of [
    '#fff',
    '#ffff',
    '#ffffff',
    '#ffffff80',
    'rgb(0,0,0)',
    'rgba(0, 0, 0, 0.6)',
    'hsl(0 0% 0%)',
    'hsla(0,0%,0%,1)',
    'white',
    'Black',
  ]) {
    assert.equal(reports(literal(value)), 1, value)
  }
  assert.equal(reports(template('#fff')), 1)
})

test('keeps strings that are not colours', () => {
  for (const value of ['#1', '#12', '#12345', 'whiteboard', 'red', 'row', '', 42, null]) {
    assert.equal(reports(literal(value)), 0, String(value))
  }
  assert.equal(reports(template('cell-', '')), 0)
})
