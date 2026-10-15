// No imports and no SST globals: Node runs this file directly in the tests and in check-account.ts.

// The personal AWS account of the backend. An account ID is not a secret. The account guard compares against it.
export const AWS_ACCOUNT_ID = '779846813799'
export const AWS_REGION = 'eu-west-1'

export const STAGES = ['felix', 'dev', 'production'] as const
export type Stage = (typeof STAGES)[number]

// A budget and other account-wide resources exist once per account, so only this stage creates them.
export const ACCOUNT_STAGE: Stage = 'production'

// The `iss` claim of the Clerk tokens of each stage. The JWT authorizer needs an exact match (ADR-027).
// null means that the stage has no Clerk instance yet.
export const CLERK_ISSUER: Record<Stage, string | null> = {
  felix: null,
  dev: null,
  production: null,
}
