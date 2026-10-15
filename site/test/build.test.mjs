import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from '../build.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, '..', 'dist')
const policy = await readFile(join(here, '..', '..', 'docs', 'privacy', 'privacy-policy.md'), 'utf8')

before(() => build())

test('the home page links to the policy and shows the contact', async () => {
  const html = await readFile(join(dist, 'index.html'), 'utf8')
  assert.match(html, /<html lang="en">/)
  assert.match(html, /<h1>Sudoku<\/h1>/)
  assert.match(html, /href="\/privacy"/)
  assert.match(html, /mailto:vandemaelefelix@gmail\.com/)
})

test('the privacy page holds the policy text', async () => {
  const html = await readFile(join(dist, 'privacy', 'index.html'), 'utf8')
  for (const phrase of [
    'Privacy policy of Sudoku',
    'Felix Vandemaele',
    'Article 6(1)(b)',
    'Delete your account',
    'Clerk',
    'eu-west-1',
    '30 days',
    '35 days',
    'Vercel',
    'Portability',
  ]) {
    assert.ok(policy.includes(phrase), `the policy lost: ${phrase}`)
    assert.ok(html.includes(phrase), `the page lacks: ${phrase}`)
  }
})

test('the privacy page hides the internal notes and has no placeholder', async () => {
  const html = await readFile(join(dist, 'privacy', 'index.html'), 'utf8')
  assert.ok(!html.includes('publish:'))
  assert.ok(!html.includes('<!--'))
  assert.ok(!html.includes('status: '))
  assert.ok(!/<contact email/.test(html))
  assert.ok(!html.includes('<script'))
})

test('the build writes the privacy page to dist/privacy/index.html', async () => {
  await access(join(dist, 'privacy', 'index.html'))
})

test('vercel.json has clean URLs, the frozen install and a CSP header', async () => {
  const config = JSON.parse(await readFile(join(here, '..', 'vercel.json'), 'utf8'))
  assert.equal(config.cleanUrls, true)
  assert.equal(config.installCommand, 'pnpm install --frozen-lockfile --filter @sudoku/site...')
  const keys = config.headers.flatMap((rule) => rule.headers.map((header) => header.key))
  assert.ok(keys.includes('Content-Security-Policy'))
})

test('the page wraps tables in a scroll container and declares the light scheme', async () => {
  const html = await readFile(join(dist, 'privacy', 'index.html'), 'utf8')
  assert.match(html, /<div class="table-wrap"><table>/)
  assert.ok(html.includes('color-scheme:light'))
  assert.ok(!html.includes('table{border-collapse:collapse;width:100%;display:block'))
})
