// Refuses a deploy of a stopped stage. `just deploy-api` runs it, and the deploy workflow runs it too.
// Usage: node infra/kill-switch-check.ts <stage>
import { execFileSync } from 'node:child_process'

import { isStage } from './account.ts'
import { AWS_REGION, STAGES } from './config.ts'
import { killSwitchFlagName, killSwitchVerdict, type ParameterRead } from './kill-switch-settings.ts'

const stage = process.argv[2] ?? ''
if (!isStage(stage)) {
  console.error(`Unknown stage "${stage}". Use one of: ${STAGES.join(', ')}.`)
  process.exit(1)
}

// In GitHub Actions the role credentials come from the environment. On the laptop the profile sudoku applies.
const profile = process.env.GITHUB_ACTIONS === 'true' ? [] : ['--profile', 'sudoku']

let read: ParameterRead
try {
  const stdout = execFileSync(
    'aws',
    [
      'ssm',
      'get-parameter',
      '--name',
      killSwitchFlagName(stage),
      '--region',
      AWS_REGION,
      ...profile,
      '--output',
      'json',
      '--query',
      'Parameter.Value',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
  // --query prints the value as a JSON string, and the value is JSON itself.
  read = { ok: true, stdout: JSON.parse(stdout) as string }
} catch (error) {
  read = { ok: false, stderr: String((error as { stderr?: unknown }).stderr ?? error) }
}

const verdict = killSwitchVerdict(stage, read)
if (!verdict.allow) {
  console.error(verdict.message)
  process.exit(1)
}
