import assert from 'node:assert/strict'
import { test } from 'node:test'
import plugin from './sudoku-plugin.mjs'

function reports(node) {
  const found = []
  const visitors = plugin.rules['no-literal-text'].create({ report: (r) => found.push(r) })
  visitors[node.type](node)
  return found.length
}
const literal = (value) => ({ type: 'Literal', value })
const template = (...cooked) => ({
  type: 'TemplateLiteral',
  quasis: cooked.map((c) => ({ value: { cooked: c } })),
  expressions: [],
})
const text = (value) => ({ type: 'JSXText', value })
const attribute = (name, value) => ({ type: 'JSXAttribute', name: { type: 'JSXIdentifier', name }, value })
const inBraces = (expression) => ({ type: 'JSXExpressionContainer', expression })
const alert = (...args) => ({
  type: 'CallExpression',
  callee: {
    type: 'MemberExpression',
    object: { type: 'Identifier', name: 'Alert' },
    property: { type: 'Identifier', name: 'alert' },
  },
  arguments: args,
})

test('refuses JSX text with a letter, in any language', () => {
  assert.equal(reports(text('Settings')), 1)
  assert.equal(reports(text('  Instellingen\n')), 1)
  assert.equal(reports(text('é')), 1)
})

test('keeps JSX text without a letter', () => {
  for (const value of ['  \n  ', ' · ', '–', '42', ':']) assert.equal(reports(text(value)), 0, JSON.stringify(value))
})

test('refuses a literal in a text prop', () => {
  for (const name of ['label', 'title', 'accessibilityLabel', 'accessibilityHint', 'placeholder']) {
    assert.equal(reports(attribute(name, literal('Back'))), 1, name)
    assert.equal(reports(attribute(name, inBraces(literal('Back')))), 1, name)
    assert.equal(reports(attribute(name, inBraces(template('Row ', '')))), 1, name)
  }
})

test('keeps a text prop that comes from the formatter, and props that are not text', () => {
  const call = { type: 'CallExpression', callee: { type: 'Identifier', name: 'format' }, arguments: [] }
  assert.equal(reports(attribute('label', inBraces(call))), 0)
  assert.equal(reports(attribute('testID', literal('back'))), 0)
  assert.equal(reports(attribute('accessibilityRole', literal('button'))), 0)
  assert.equal(reports(attribute('title', literal(' – '))), 0)
})

test('refuses literal text in Alert.alert', () => {
  assert.equal(reports(alert(literal('Sign out?'))), 1)
  assert.equal(reports(alert({ type: 'Identifier', name: 'title' }, template('Delete ', '?'))), 1)
  assert.equal(reports(alert({ type: 'Identifier', name: 'title' })), 0)
})

test('refuses literal text in braces as a child of an element', () => {
  const element = { type: 'JSXElement' }
  assert.equal(reports({ ...inBraces(template('Version ', '')), parent: element }), 1)
  assert.equal(reports({ ...inBraces(literal('Paused')), parent: { type: 'JSXFragment' } }), 1)
  assert.equal(reports({ ...inBraces(template(' · ', '')), parent: element }), 0)
  // A prop value in braces is the job of the prop check, so it is not reported twice.
  assert.equal(reports({ ...inBraces(literal('Back')), parent: { type: 'JSXAttribute' } }), 0)
})
