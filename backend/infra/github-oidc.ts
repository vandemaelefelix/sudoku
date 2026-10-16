import { deployPlan, type Stage } from './config.ts'
import { DEPLOY_ROLES, GITHUB_OIDC_HOST, trustPolicy } from './github-oidc-policy.ts'

// AWS allows one OIDC provider per issuer, so only the account stage creates it (ADR-027, decision 5).
// The first deploy of this file runs from the laptop, because the roles must exist before CI can take them.
function createDeployRoles() {
  const provider = new aws.iam.OpenIdConnectProvider('GithubOidc', {
    url: `https://${GITHUB_OIDC_HOST}`,
    clientIdLists: ['sts.amazonaws.com'],
  })
  const role = (name: 'Dev' | 'Production', config: (typeof DEPLOY_ROLES)[keyof typeof DEPLOY_ROLES]) => {
    const created = new aws.iam.Role(`GithubDeploy${name}`, {
      name: config.roleName,
      maxSessionDuration: 3600,
      assumeRolePolicy: $jsonStringify(trustPolicy(provider.arn, config.workflowFile)),
    })
    // SST creates IAM roles, so a narrower policy would not hold a boundary (ADR-010, amendment).
    // oxlint-disable-next-line eslint/no-new -- A Pulumi resource registers itself in its constructor.
    new aws.iam.RolePolicyAttachment(`GithubDeploy${name}Admin`, {
      role: created.name,
      policyArn: 'arn:aws:iam::aws:policy/AdministratorAccess',
    })
    return created.arn
  }
  return {
    githubDeployRoleDev: role('Dev', DEPLOY_ROLES.dev),
    githubDeployRoleProduction: role('Production', DEPLOY_ROLES.production),
  }
}

export const deployRoles = deployPlan($app.stage as Stage).account ? createDeployRoles() : {}
