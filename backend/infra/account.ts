import { AWS_ACCOUNT_ID, STAGES, type Stage } from './config.ts'

const ACCOUNT_ID_PATTERN = /^\d{12}$/

// Returns null when the accounts match, otherwise the message for the developer.
export function accountProblem(actual: string, expected: string): string | null {
  if (!ACCOUNT_ID_PATTERN.test(expected)) {
    return `AWS_ACCOUNT_ID in backend/infra/config.ts is "${expected}", not a 12-digit account ID.`
  }
  if (actual === expected) return null
  return (
    `The AWS credentials belong to account ${actual}, not to ${expected}. ` +
    'The backend deploys only to the personal account. Run: aws login --profile sudoku-login'
  )
}

export function isStage(name: string): name is Stage {
  return (STAGES as readonly string[]).includes(name)
}

export function assertKnownStage(name: string): Stage {
  if (!isStage(name)) {
    throw new Error(`Unknown stage "${name}". Use one of: ${STAGES.join(', ')}.`)
  }
  return name
}

// Uses the SST global `aws`, so call it only inside run().
export async function assertPersonalAccount(): Promise<void> {
  const identity = await aws.getCallerIdentity({})
  const problem = accountProblem(identity.accountId, AWS_ACCOUNT_ID)
  if (problem) throw new Error(problem)
}

// The account ID of the credentials, for the layer 1 guard. runAws adds the profile.
export const CALLER_ACCOUNT_ARGS = ['sts', 'get-caller-identity', '--query', 'Account', '--output', 'text']
