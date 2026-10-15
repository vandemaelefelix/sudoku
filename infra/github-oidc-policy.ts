// No SST globals: Node runs this file directly in the tests.
import { GITHUB_REPO } from './config.ts'

export const GITHUB_OIDC_HOST = 'token.actions.githubusercontent.com'

// The deploy workflow files. The trust policy of a role names exactly one file, so no other workflow can take it.
export const DEV_WORKFLOW = 'deploy-api-dev.yml'
export const PRODUCTION_WORKFLOW = 'deploy-api-production.yml'

export const DEPLOY_BRANCH = 'develop'

export interface DeployRoleTrust {
  roleName: string
  workflowFile: string
}

export const DEPLOY_ROLES = {
  dev: { roleName: 'sudoku-github-dev', workflowFile: DEV_WORKFLOW },
  production: { roleName: 'sudoku-github-production', workflowFile: PRODUCTION_WORKFLOW },
} as const satisfies Record<'dev' | 'production', DeployRoleTrust>

// Generic over the provider ARN, so the tests pass a string and github-oidc.ts passes an Output.
// The repository is not a wildcard. A job without a GitHub environment has this `sub`. The private repository
// is on the Free plan and has no environments, so the workflow file and the branch carry the trust (ADR-010, amendment).
export function trustPolicy<T>(providerArn: T, workflowFile: string, repo: string = GITHUB_REPO) {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { Federated: providerArn },
        Action: 'sts:AssumeRoleWithWebIdentity',
        Condition: {
          StringEquals: {
            [`${GITHUB_OIDC_HOST}:aud`]: 'sts.amazonaws.com',
            [`${GITHUB_OIDC_HOST}:sub`]: `repo:${repo}:ref:refs/heads/${DEPLOY_BRANCH}`,
            [`${GITHUB_OIDC_HOST}:job_workflow_ref`]: `${repo}/.github/workflows/${workflowFile}@refs/heads/${DEPLOY_BRANCH}`,
          },
        },
      },
    ],
  }
}
