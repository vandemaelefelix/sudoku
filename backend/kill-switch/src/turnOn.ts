export interface Throttle {
  throttlingRateLimit: number
  throttlingBurstLimit: number
}

export interface TurnOnDeps {
  findApis(stage: string): Promise<string[]>
  findFunctions(stage: string): Promise<string[]>
  startApi(apiId: string, throttle: Throttle): Promise<void>
  startFunction(name: string): Promise<void>
  clearFlag(stage: string): Promise<void>
}

// The flag goes last. When a step throws, the flag stays and the stage stays blocked.
export async function turnOn(deps: TurnOnDeps, stage: string, throttle: Throttle): Promise<void> {
  // oxlint-disable-next-line eslint/no-await-in-loop -- A stage holds one API. The calls run one by one to keep the failure order clear.
  for (const apiId of await deps.findApis(stage)) await deps.startApi(apiId, throttle)
  // oxlint-disable-next-line eslint/no-await-in-loop -- A stage holds one function. The calls run one by one.
  for (const name of await deps.findFunctions(stage)) await deps.startFunction(name)
  await deps.clearFlag(stage)
}
