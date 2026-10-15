// No imports and no SST globals: Node runs this file directly in the tests and in check-account.ts.

// The personal AWS account of the backend. An account ID is not a secret. The account guard compares against it.
export const AWS_ACCOUNT_ID = '779846813799'
export const AWS_REGION = 'eu-west-1'

export const STAGES = ['felix', 'dev', 'production'] as const
export type Stage = (typeof STAGES)[number]

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

// The `aud` that the Clerk JWT template `sudoku-api` adds. The JWT authorizer requires it (ADR-027, decision 1).
export const CLERK_AUDIENCE = 'sudoku-api'
