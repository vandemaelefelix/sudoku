import { flagIsSet, stoppedMessage } from './kill-switch-settings.ts'

// Layer 4 of the guard, for `sst deploy` and `sst dev` that skip the just recipe. Call it only inside run().
// It lists the parameters, because a read of a missing parameter throws.
export async function assertNotStopped(stage: string): Promise<void> {
  const found = await aws.ssm.getParametersByPath({ path: '/sudoku/kill-switch' })
  if (flagIsSet(found.names, stage)) throw new Error(stoppedMessage(stage, 'see the flag in SSM'))
}
