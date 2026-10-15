import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync(new URL('../sst.config.ts', import.meta.url), 'utf8')

describe('sst.config.ts', () => {
  it('takes the stages and the region from infra/config.ts', () => {
    assert.match(source, /await import\('\.\/infra\/config\.ts'\)/)
    assert.doesNotMatch(source, /'eu-west-1'/)
    assert.doesNotMatch(source, /\['felix', 'dev', 'production'\]/)
  })
})
