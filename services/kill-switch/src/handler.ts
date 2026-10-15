import { createAwsOps } from './aws.ts'
import { createClients } from './clients.ts'
import { killSwitch } from './killSwitch.ts'

// Any message on the topic stops every stage. Only the budget service and this account can publish (ADR-027).
export async function handler(): Promise<void> {
  const stages = (process.env.STAGES ?? '').split(',').filter(Boolean)
  if (stages.length === 0) throw new Error('STAGES is empty.')
  const ops = createAwsOps(createClients(), { alertTopicArn: process.env.ALERT_TOPIC_ARN })
  await killSwitch({ ...ops, now: () => new Date() }, stages)
}
