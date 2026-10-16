export interface Throttle {
  throttlingRateLimit: number
  throttlingBurstLimit: number
}

export interface TurnOnDeps {
  findApis(stage: string): Promise<string[]>
  findFunctions(stage: string): Promise<string[]>
  // routeThrottles maps a route key to a limit that wins over `throttle` for that route.
  startApi(apiId: string, throttle: Throttle, routeThrottles?: Record<string, Throttle>): Promise<void>
  startFunction(name: string): Promise<void>
  clearFlag(stage: string): Promise<void>
}

// The flag goes last. When a step throws, the flag stays and the stage stays blocked.
export async function turnOn(
  deps: TurnOnDeps,
  stage: string,
  throttle: Throttle,
  routeThrottles: Record<string, Throttle> = {},
): Promise<void> {
  // oxlint-disable-next-line eslint/no-await-in-loop -- A stage holds one API. The calls run one by one to keep the failure order clear.
  for (const apiId of await deps.findApis(stage)) await deps.startApi(apiId, throttle, routeThrottles)
  // oxlint-disable-next-line eslint/no-await-in-loop -- A stage holds one function. The calls run one by one.
  for (const name of await deps.findFunctions(stage)) await deps.startFunction(name)
  await deps.clearFlag(stage)
}
