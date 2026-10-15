import type { FlagValue } from './flag.ts'

// handler.ts and the tests pass these. Every call is idempotent, so SNS can retry the whole run.
export interface KillSwitchDeps {
  setFlag(stage: string, value: FlagValue): Promise<void>
  findApis(stage: string): Promise<string[]>
  findFunctions(stage: string): Promise<string[]>
  stopApi(apiId: string): Promise<void>
  stopFunction(name: string): Promise<void>
  notify(subject: string, body: string): Promise<void>
  now(): Date
}

interface StageReport {
  stage: string
  stopped: string[]
  failures: string[]
}

async function attempt(report: StageReport, label: string, step: () => Promise<void>): Promise<void> {
  try {
    await step()
    report.stopped.push(label)
  } catch (error) {
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    report.failures.push(`${label}: ${reason}`)
  }
}

async function stopStage(deps: KillSwitchDeps, stage: string): Promise<StageReport> {
  const report: StageReport = { stage, stopped: [], failures: [] }
  // The flag comes first. A stop that fails halfway must still block a deploy that resets the throttle.
  // A stage without resources gets the flag too, so a later deploy cannot start it.
  const value: FlagValue = { at: deps.now().toISOString(), reason: 'budget' }
  await attempt(report, 'flag', () => deps.setFlag(stage, value))
  try {
    for (const apiId of await deps.findApis(stage)) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- The calls run one by one, so the report keeps the order.
      await attempt(report, `api ${apiId}`, () => deps.stopApi(apiId))
    }
  } catch (error) {
    report.failures.push(`find the API: ${error instanceof Error ? error.message : String(error)}`)
  }
  try {
    for (const name of await deps.findFunctions(stage)) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- The calls run one by one, so the report keeps the order.
      await attempt(report, `function ${name}`, () => deps.stopFunction(name))
    }
  } catch (error) {
    report.failures.push(`find the function: ${error instanceof Error ? error.message : String(error)}`)
  }
  return report
}

function summary(reports: StageReport[]): string {
  const lines = reports.map((r) =>
    r.failures.length === 0
      ? `${r.stage}: stopped (${r.stopped.join(', ')})`
      : `${r.stage}: FAILED. ${r.failures.join('; ')}`,
  )
  return [
    'The budget passed the kill-switch threshold. The kill switch ran for every stage.',
    '',
    ...lines,
    '',
    'Check the bill. Then turn a stage on again with: just api-on <stage>',
  ].join('\n')
}

// One failure never stops the other stages. The function throws at the end, so SNS retries it.
export async function killSwitch(deps: KillSwitchDeps, stages: readonly string[]): Promise<void> {
  const reports: StageReport[] = []
  // oxlint-disable-next-line eslint/no-await-in-loop -- One stage at a time keeps the AWS call rate low and the report in order.
  for (const stage of stages) reports.push(await stopStage(deps, stage))
  const failed = reports.filter((r) => r.failures.length > 0)
  const subject = failed.length === 0 ? 'Sudoku kill switch: stopped' : 'Sudoku kill switch: FAILED'
  await deps.notify(subject, summary(reports))
  if (failed.length > 0) {
    throw new Error(`The kill switch failed for: ${failed.map((r) => r.stage).join(', ')}`)
  }
}
