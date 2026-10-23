// Layer 1 of the account guard (backend/infra/README.md). The just recipes and the deploy workflows run it before every sst command,
// because the SST bootstrap writes its state bucket before run() can check the account.
import { CALLER_ACCOUNT_ARGS, accountProblem } from './account.ts'
import { isCi, runAws } from './awsCli.ts'
import { AWS_ACCOUNT_ID } from './config.ts'

let actual: string
try {
  actual = runAws(CALLER_ACCOUNT_ARGS, { stderr: 'inherit' })
} catch {
  console.error(
    isCi()
      ? 'The role credentials are not valid. Check the repository variable of the deploy role.'
      : 'The profile sudoku has no valid credentials. Run: aws login --profile sudoku-login',
  )
  process.exit(1)
}

const problem = accountProblem(actual, AWS_ACCOUNT_ID)
if (problem) {
  console.error(problem)
  process.exit(1)
}
