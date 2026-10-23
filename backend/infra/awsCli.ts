// No SST globals: Node runs the scripts that import this file, and the tests import it.
import { execFileSync } from 'node:child_process'

// The only AWS profile that the backend uses (backend/infra/README.md, the account guard).
export const AWS_PROFILE = 'sudoku'

// In GitHub Actions the role credentials come from the environment, and no profile sudoku exists.
export const profileArgs = (inCi: boolean): string[] => (inCi ? [] : ['--profile', AWS_PROFILE])

export const isCi = (): boolean => process.env.GITHUB_ACTIONS === 'true'

// Runs the AWS CLI with the profile sudoku and returns stdout without the trailing newline. A non-zero exit throws.
// `stderr` says where the CLI error text goes: the caller reads it from the thrown error only for 'pipe'.
export function runAws(args: readonly string[], options: { stderr?: 'pipe' | 'inherit' | 'ignore' } = {}): string {
  return execFileSync('aws', [...args, ...profileArgs(isCi())], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', options.stderr ?? 'pipe'],
  }).trim()
}
