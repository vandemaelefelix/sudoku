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
    assert.match(source, /return \{ apiUrl: api\.url, \.\.\.deployRoles \}/)
  })

  it('creates the GitHub deploy roles', () => {
    assert.match(source, /await import\('\.\/infra\/github-oidc\.ts'\)/)
  })

  it('creates the table, the function and the API only when the stage deploys the app', () => {
    const gate = source.indexOf('if (!plan.app)')
    assert.ok(gate > 0)
    assert.ok(gate < source.indexOf("import('./infra/clerk.ts')"))
    assert.ok(gate < source.indexOf("import('./infra/storage.ts')"))
    assert.ok(gate < source.indexOf("import('./infra/api.ts')"))
    assert.ok(source.indexOf("import('./infra/budget.ts')") < gate, 'the account resources come first')
  })

  it('plans the stage before it creates any resource, so a stage without an issuer throws first', () => {
    const plan = source.indexOf('deployPlan(stage)')
    assert.ok(plan > source.indexOf('assertNotStopped($app.stage, $cli.command)'))
    assert.ok(plan < source.indexOf("import('./infra/defaults.ts')"))
    assert.ok(plan < source.indexOf("import('./infra/budget.ts')"))
  })

  it('refuses a stopped stage before it creates a resource', () => {
    const guard = source.indexOf('assertNotStopped($app.stage, $cli.command)')
    assert.ok(guard > source.indexOf('assertPersonalAccount()'))
    assert.ok(guard < source.indexOf("import('./infra/defaults.ts')"))
  })
})
