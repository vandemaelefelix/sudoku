import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, it } from 'node:test'

import { AWS_REGION } from './config.ts'
import { DEV_WORKFLOW, PRODUCTION_WORKFLOW } from './github-oidc-policy.ts'

const root = new URL('../../.github/', import.meta.url)

const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

const files = [
  ...readdirSync(new URL('workflows/', root)).map((name) => `workflows/${name}`),
  ...readdirSync(new URL('actions/', root)).map((name) => `actions/${name}/action.yml`),
]

describe('workflows and actions', () => {
  it('pin every external action to a 40-character commit SHA (ADR-027, decision 8)', () => {
    for (const file of files) {
      for (const [, ref] of read(file).matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)) {
        if (ref!.startsWith('./')) continue
        assert.match(ref!, /@[0-9a-f]{40}$/, `${file} uses ${ref}`)
      }
    }
  })

  it('never use an AWS access key (ADR-027, decision 2)', () => {
    for (const file of files) {
      assert.doesNotMatch(read(file), /aws-access-key-id|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY/i, file)
    }
  })

  it('ask for the id-token only at job level', () => {
    for (const name of [DEV_WORKFLOW, PRODUCTION_WORKFLOW]) {
      const text = read(`workflows/${name}`)
      assert.match(text, /^permissions: \{\}$/m, `${name} needs empty top-level permissions`)
      assert.doesNotMatch(text, /^permissions:\s*\n/m, name)
      assert.match(text, /^ {4}permissions:\n {6}id-token: write$/m, name)
    }
  })

  it('give each role its own trigger', () => {
    assert.match(read(`workflows/${DEV_WORKFLOW}`), /branches: \[develop\]/)
    assert.doesNotMatch(read(`workflows/${DEV_WORKFLOW}`), /workflow_dispatch/)
    const production = read(`workflows/${PRODUCTION_WORKFLOW}`)
    assert.match(production, /^on:\n {2}workflow_dispatch:$/m)
    assert.doesNotMatch(production, /^ {2}push:/m)
  })

  it('run the production jobs only from develop', () => {
    const production = read(`workflows/${PRODUCTION_WORKFLOW}`)
    const guards = production.match(/if: github\.ref == 'refs\/heads\/develop'/g) ?? []
    assert.equal(guards.length, 2)
  })

  it('use the region of backend/infra/config.ts', () => {
    assert.match(read('actions/aws-guard/action.yml'), new RegExp(`aws-region: ${AWS_REGION}$`, 'm'))
  })
})
