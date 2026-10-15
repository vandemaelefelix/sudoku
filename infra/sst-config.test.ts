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

  it('declares the Clerk secret key in run()', () => {
    assert.match(source, /await import\('\.\/infra\/clerk\.ts'\)/)
  })

  it('creates the table and the sync API, and returns the API URL', () => {
    assert.match(source, /await import\('\.\/infra\/storage\.ts'\)/)
    assert.match(source, /const \{ api \} = await import\('\.\/infra\/api\.ts'\)/)
    assert.match(source, /return \{ apiUrl: api\.url \}/)
  })

  it('refuses a stopped stage before it creates a resource', () => {
    const guard = source.indexOf('assertNotStopped($app.stage, $cli.command)')
    assert.ok(guard > source.indexOf('assertPersonalAccount()'))
    assert.ok(guard < source.indexOf("import('./infra/defaults.ts')"))
  })
})
