// No SST globals: `node --test` runs the tests, and kill-switch-check.ts and api-on.ts run this file in Node.
import { isStage } from './account.ts'
import { STAGES } from './config.ts'
import { killSwitchFlagName } from '../services/kill-switch/src/flag.ts'

export { killSwitchFlagName }

// API Gateway checks these on every UpdateStage of a stage with access logging. The actions take no resource ARN, so the
// permission uses "*". Source: AWS docs, "Configure logging for HTTP APIs in API Gateway" (ADR-027).
export const LOG_DELIVERY_ACTIONS = [
  'logs:CreateLogDelivery',
  'logs:GetLogDelivery',
  'logs:UpdateLogDelivery',
  'logs:DeleteLogDelivery',
  'logs:ListLogDeliveries',
  'logs:PutResourcePolicy',
  'logs:DescribeResourcePolicies',
  'logs:DescribeLogGroups',
] as const

export type ParameterRead = { ok: true; stdout: string } | { ok: false; stderr: string }
export type Verdict = { allow: true } | { allow: false; message: string }

export function stoppedMessage(stage: string, when: string): string {
  return (
    `The kill switch stopped stage ${stage} (${when}). A deploy would set the throttle again. ` +
    `Check the bill. Then run: just api-on ${stage}`
  )
}

// Fails closed: only a missing flag allows a deploy. A denied or broken check must not deploy (SUD-11).
export function killSwitchVerdict(stage: string, read: ParameterRead): Verdict {
  if (!read.ok) {
    // The CLI prints `An error occurred (ParameterNotFound) when calling ...`. The code in parentheses is the match.
    if (/\(ParameterNotFound\)/.test(read.stderr)) return { allow: true }
    return {
      allow: false,
      message: `The kill-switch flag of stage ${stage} could not be checked: ${read.stderr.trim()}`,
    }
  }
  try {
    const value = JSON.parse(read.stdout) as { at?: unknown }
    return { allow: false, message: stoppedMessage(stage, `at ${String(value.at)}`) }
  } catch {
    return { allow: false, message: stoppedMessage(stage, 'at an unknown time') }
  }
}

// `sst remove` and `sst diff` must work for a stopped stage: remove deletes the resources, and diff changes nothing.
export function guardApplies(command: string): boolean {
  return command !== 'remove' && command !== 'diff'
}

// sst.config.ts passes the names that `aws.ssm.getParametersByPath` returns.
export function flagIsSet(names: readonly string[], stage: string): boolean {
  return names.includes(killSwitchFlagName(stage))
}

export function parseApiOnArgs(argv: readonly string[]): { stage: string; yes: boolean } {
  let yes = false
  const names: string[] = []
  for (const arg of argv) {
    if (arg === '--yes') yes = true
    else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}. The only option is --yes.`)
    else names.push(arg)
  }
  const stage = names[0] ?? ''
  if (!isStage(stage)) throw new Error(`Unknown stage "${stage}". Use one of: ${STAGES.join(', ')}.`)
  return { stage, yes }
}
