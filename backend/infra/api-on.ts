// Turns a stopped stage on again (ADR-027). Run it with `just api-on <stage>`, after you check the bill.
// Usage: node backend/infra/api-on.ts <stage> [--yes]
import { createInterface } from 'node:readline/promises'

import { createAwsOps } from '../kill-switch/src/aws.ts'
import { createClients } from '../kill-switch/src/clients.ts'
import { turnOn } from '../kill-switch/src/turnOn.ts'
import { SCANS_ROUTE_KEY, SCANS_THROTTLE, STAGE_THROTTLE } from './backend-settings.ts'
import { runAws } from './awsCli.ts'
import { AWS_REGION } from './config.ts'
import { parseApiOnArgs } from './kill-switch-settings.ts'

function monthToDateCost(): string {
  const start = new Date().toISOString().slice(0, 8) + '01'
  const end = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  try {
    return runAws(
      [
        'ce',
        'get-cost-and-usage',
        '--region',
        'us-east-1',
        '--time-period',
        `Start=${start},End=${end}`,
        '--granularity',
        'MONTHLY',
        '--metrics',
        'UnblendedCost',
        '--query',
        'ResultsByTime[0].Total.UnblendedCost.[Amount,Unit]',
        '--output',
        'text',
      ],
      { stderr: 'ignore' },
    )
  } catch {
    return 'unknown (Cost Explorer did not answer)'
  }
}

let args: { stage: string; yes: boolean }
try {
  args = parseApiOnArgs(process.argv.slice(2))
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}

console.log(`Cost this month so far: ${monthToDateCost()}`)
if (!args.yes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`Turn stage ${args.stage} on again? Type y to continue: `)
  rl.close()
  if (answer.trim().toLowerCase() !== 'y') {
    console.log('Nothing changed.')
    process.exit(1)
  }
}

const ops = createAwsOps(createClients(AWS_REGION))
try {
  await turnOn(ops, args.stage, STAGE_THROTTLE, { [SCANS_ROUTE_KEY]: SCANS_THROTTLE })
} catch (error) {
  console.error(`Stage ${args.stage} stays stopped, and its flag stays. ${(error as Error).message}`)
  process.exit(1)
}
console.log(`Stage ${args.stage} is on. Run just deploy-api ${args.stage} if the stage needs a deploy.`)
