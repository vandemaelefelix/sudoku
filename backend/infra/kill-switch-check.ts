// Refuses a deploy of a stopped stage. `just deploy-api` runs it, and the deploy workflow runs it too.
// Usage: node backend/infra/kill-switch-check.ts <stage>
import { assertKnownStage } from './account.ts'
import { runAws } from './awsCli.ts'
import { AWS_REGION } from './config.ts'
import { killSwitchFlagName, killSwitchVerdict, type ParameterRead } from './kill-switch-settings.ts'

const stage = assertKnownStage(process.argv[2] ?? '')

let read: ParameterRead
try {
  const stdout = runAws([
    'ssm',
    'get-parameter',
    '--name',
    killSwitchFlagName(stage),
    '--region',
    AWS_REGION,
    '--output',
    'json',
    '--query',
    'Parameter.Value',
  ])
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
