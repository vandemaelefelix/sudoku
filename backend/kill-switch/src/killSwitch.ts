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
  // Steps that failed but leave the stage stopped. The route throttle is the stop (ADR-027).
  warnings: string[]
}

// A failure marks the stage FAILED. A warning leaves the stage stopped (the throttle is the stop).
type Severity = 'failures' | 'warnings'

const describe = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error)

// The text carries the severity, so the summary prints it as it is.
const problem = (label: string, reason: string, severity: Severity): string =>
  severity === 'warnings' ? `${label}: failed, ${reason}` : `${label}: ${reason}`

async function attempt(
  report: StageReport,
  label: string,
  step: () => Promise<void>,
  severity: Severity = 'failures',
): Promise<void> {
  try {
    await step()
    report.stopped.push(label)
  } catch (error) {
    const reason = describe(error)
    report[severity].push(problem(label, reason, severity))
    console.error(`Kill switch step failed. stage=${report.stage} step=${label} reason=${reason}`)
  }
}

// Finds the resources of one kind and stops each one by one. A failed lookup counts like a failed stop.
async function stopAll(
  report: StageReport,
  kind: { name: string; noun: string },
  find: () => Promise<string[]>,
  stop: (id: string) => Promise<void>,
  severity: Severity,
): Promise<void> {
  try {
    for (const id of await find()) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- The calls run one by one, so the report keeps the order.
      await attempt(report, `${kind.name} ${id}`, () => stop(id), severity)
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    report[severity].push(problem(`find the ${kind.noun}`, reason, severity))
  }
}

async function stopStage(deps: KillSwitchDeps, stage: string): Promise<StageReport> {
  const report: StageReport = { stage, stopped: [], failures: [], warnings: [] }
  // The flag comes first. A stop that fails halfway must still block a deploy that resets the throttle.
  // A stage without resources gets the flag too, so a later deploy cannot start it.
  const value: FlagValue = { at: deps.now().toISOString(), reason: 'budget' }
  await attempt(report, 'flag', () => deps.setFlag(stage, value))
  await stopAll(
    report,
    { name: 'api', noun: 'API' },
    () => deps.findApis(stage),
    (id) => deps.stopApi(id),
    'failures',
  )
  // The concurrency stop is best-effort when the throttle is in place. Without a throttle it is the only stop.
  const throttled = report.stopped.some((label) => label.startsWith('api ')) && report.failures.length === 0
  await stopAll(
    report,
    { name: 'function', noun: 'function' },
    () => deps.findFunctions(stage),
    (name) => deps.stopFunction(name),
    throttled ? 'warnings' : 'failures',
  )
  return report
}

function summary(reports: StageReport[]): string {
  const lines = reports.map((r) => {
    if (r.failures.length > 0) return `${r.stage}: FAILED. ${r.failures.join('; ')}`
    const warned = r.warnings.length > 0 ? `. Not stopped: ${r.warnings.join('; ')}` : ''
    return `${r.stage}: stopped (${r.stopped.join(', ')})${warned}`
  })
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
  // A broken notification must not hide a stage failure, and must not make SNS retry a finished stop.
  try {
    await deps.notify(subject, summary(reports))
  } catch (error) {
    if (failed.length === 0) console.error('The kill switch could not send its summary.', error)
  }
  if (failed.length > 0) {
    throw new Error(`The kill switch failed for: ${failed.map((r) => r.stage).join(', ')}`)
  }
}
