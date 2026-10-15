import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { GITHUB_REPO, GITHUB_REPOSITORY_ID } from './config.ts'
import { DEPLOY_ROLES, DEV_WORKFLOW, PRODUCTION_WORKFLOW, trustPolicy } from './github-oidc-policy.ts'

const HOST = 'token.actions.githubusercontent.com'

describe('trustPolicy', () => {
  const policy = trustPolicy('arn:provider', DEV_WORKFLOW)
  const statement = policy.Statement[0]!
  const equals = statement.Condition.StringEquals

  it('allows only web identity from the GitHub provider', () => {
    assert.equal(statement.Effect, 'Allow')
    assert.equal(statement.Action, 'sts:AssumeRoleWithWebIdentity')
    assert.equal(statement.Principal.Federated, 'arn:provider')
  })

  it('requires the AWS audience', () => {
    assert.equal(equals[`${HOST}:aud`], 'sts.amazonaws.com')
  })

  it('pins the repository and the develop branch exactly', () => {
    assert.equal(equals[`${HOST}:sub`], 'repo:vandemaelefelix@32290789/sudoku@1412094169:ref:refs/heads/develop')
    assert.equal(equals[`${HOST}:repository_id`], '1412094169')
    assert.equal(GITHUB_REPOSITORY_ID, '1412094169')
  })

  it('pins the workflow file on develop', () => {
    assert.equal(
      equals[`${HOST}:job_workflow_ref`],
      `${GITHUB_REPO}/.github/workflows/${DEV_WORKFLOW}@refs/heads/develop`,
    )
  })

  it('has no wildcard and no StringLike', () => {
    const text = JSON.stringify(policy)
    assert.doesNotMatch(text, /\*/)
    assert.doesNotMatch(text, /StringLike/)
  })
})

describe('DEPLOY_ROLES', () => {
  it('gives each role its own workflow file', () => {
    assert.equal(DEPLOY_ROLES.dev.workflowFile, DEV_WORKFLOW)
    assert.equal(DEPLOY_ROLES.production.workflowFile, PRODUCTION_WORKFLOW)
    assert.notEqual(DEV_WORKFLOW, PRODUCTION_WORKFLOW)
  })

  it('makes the dev and production trust differ only by job_workflow_ref', () => {
    const conditions = (workflowFile: string) =>
      trustPolicy('x', workflowFile).Statement[0]!.Condition.StringEquals as Record<string, string>
    const dev = conditions(DEPLOY_ROLES.dev.workflowFile)
    const production = conditions(DEPLOY_ROLES.production.workflowFile)
    const differing = Object.keys(dev).filter((key) => dev[key] !== production[key])
    assert.deepEqual(differing, [`${HOST}:job_workflow_ref`])
    assert.deepEqual(Object.keys(dev).sort(), Object.keys(production).sort())
  })

  it('keeps the production workflow out of the dev trust and the other way round', () => {
    const dev = JSON.stringify(trustPolicy('x', DEPLOY_ROLES.dev.workflowFile))
    const production = JSON.stringify(trustPolicy('x', DEPLOY_ROLES.production.workflowFile))
    assert.ok(!dev.includes(PRODUCTION_WORKFLOW))
    assert.ok(!production.includes(DEV_WORKFLOW))
  })
})
