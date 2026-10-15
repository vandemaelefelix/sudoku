// No imports and no SST globals: Node runs this file directly in the tests and in check-account.ts.

// The personal AWS account of the backend. An account ID is not a secret. The account guard compares against it.
export const AWS_ACCOUNT_ID = '779846813799'
export const AWS_REGION = 'eu-west-1'

export const STAGES = ['felix', 'dev', 'production'] as const
export type Stage = (typeof STAGES)[number]

// The only repository that may take a deploy role (ADR-027, decision 8). The trust policy matches it exactly.
export const GITHUB_REPO = 'vandemaelefelix/sudoku'

// The repository uses immutable OIDC subject claims. These IDs come from the GitHub API:
// `gh api repos/vandemaelefelix/sudoku/actions/oidc/customization/sub` (`sub_claim_prefix`) and `gh api repos/vandemaelefelix/sudoku`.
export const GITHUB_OWNER_ID = '32290789'
export const GITHUB_REPOSITORY_ID = '1412094169'

// A budget and other account-wide resources exist once per account, so only this stage creates them.
export const ACCOUNT_STAGE: Stage = 'production'

// The development instance of the Clerk application "Sudoku". felix and dev share it (ADR-027).
const CLERK_DEVELOPMENT_ISSUER = 'https://free-leopard-5298.clerk.accounts.dev'

// The `iss` claim of the Clerk tokens of each stage. The JWT authorizer needs an exact match (ADR-027).
// null means that the stage has no Clerk instance yet.
export const CLERK_ISSUER: Record<Stage, string | null> = {
  felix: CLERK_DEVELOPMENT_ISSUER,
  dev: CLERK_DEVELOPMENT_ISSUER,
  production: null,
}

export const hasClerk = (stage: Stage): boolean => CLERK_ISSUER[stage] !== null

// The `aud` that the Clerk JWT template `sudoku-api` adds. The JWT authorizer requires it (ADR-027, decision 1).
export const CLERK_AUDIENCE = 'sudoku-api'

// What a stage deploys. Only the account stage may skip the app while it has no Clerk issuer, so it can create the
// account-wide resources before its Clerk instance exists (ADR-027). Any other stage throws: skipping the app would
// delete its table, because only production protects its resources.
export function deployPlan(
  stage: Stage,
  issuers: Record<Stage, string | null> = CLERK_ISSUER,
): { account: boolean; app: boolean } {
  const account = stage === ACCOUNT_STAGE
  const app = issuers[stage] !== null
  if (!app && !account) throw new Error(`Stage ${stage} has no Clerk issuer. Set CLERK_ISSUER in infra/config.ts.`)
  return { account, app }
}
