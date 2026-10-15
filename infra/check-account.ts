// Layer 1 of the account guard (infra/README.md). The just recipes run it before every sst command,
// because the SST bootstrap writes its state bucket before run() can check the account.
import { execFileSync } from 'node:child_process'

import { accountProblem } from './account.ts'
import { AWS_ACCOUNT_ID } from './config.ts'

let actual: string
try {
  actual = execFileSync(
    'aws',
    ['sts', 'get-caller-identity', '--profile', 'sudoku', '--query', 'Account', '--output', 'text'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  ).trim()
} catch {
  console.error('The profile sudoku has no valid credentials. Run: aws login --profile sudoku-login')
  process.exit(1)
}

const problem = accountProblem(actual, AWS_ACCOUNT_ID)
if (problem) {
  console.error(problem)
  process.exit(1)
}
