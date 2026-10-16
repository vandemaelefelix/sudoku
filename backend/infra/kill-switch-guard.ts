import { flagIsSet, guardApplies, stoppedMessage } from './kill-switch-settings.ts'

// Layer 4 of the guard, for `sst deploy` and `sst dev` that skip the just recipe. Call it only inside run().
// It lists the parameters, because a read of a missing parameter throws.
// `command` is `$cli.command` of SST: deploy, dev, remove, diff and so on.
export async function assertNotStopped(stage: string, command: string): Promise<void> {
  if (!guardApplies(command)) return
  const found = await aws.ssm.getParametersByPath({ path: '/sudoku/kill-switch' })
  if (flagIsSet(found.names, stage)) throw new Error(stoppedMessage(stage, 'see the flag in SSM'))
}
