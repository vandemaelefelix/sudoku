import type { StartCounts } from './api/types'

export type FlowId = 'a' | 'b'

export interface Step {
  id: string
  name: string
  route: string
  /** The open work of the step, in words. null: nothing waits. */
  count: (counts: StartCounts) => string | null
  /** What the start page shows when nothing waits. Default: "Done". */
  idle?: (counts: StartCounts) => string
}

const finish: Step = {
  id: 'finish',
  name: 'Finish',
  route: 'finish',
  count: (c) => (c.changes ? `${c.changes} unfinished changes` : null),
  idle: () => 'Nothing to finish',
}

export const FLOWS: Record<FlowId, { name: string; about: string; steps: Step[] }> = {
  a: {
    name: 'From sudoku photos',
    about: 'Uploaded app scans and photos of just import-photos.',
    steps: [
      { id: 'fetch', name: 'Fetch new scans', route: 'a/fetch', count: () => null, idle: () => 'Any time' },
      {
        id: 'outlines',
        name: 'Outlines',
        route: 'a/outlines',
        count: (c) => (c.outlines ? `${c.outlines} to check` : null),
      },
      {
        id: 'cells',
        name: 'Cells per digit',
        route: 'a/cells',
        count: (c) => (c.scan_cells ? `${c.scan_cells} cells of ${c.scans} scans` : null),
      },
      { ...finish, route: 'a/finish' },
    ],
  },
  b: {
    name: 'From loose cells',
    about: 'Cells in unlabeled/ without a photo.',
    steps: [
      {
        id: 'prelabel',
        name: 'Pre-label',
        route: 'b/prelabel',
        count: (c) => (c.not_prelabelled ? `${c.not_prelabelled} without a guess` : null),
      },
      { id: 'digits', name: 'Digits', route: 'b/digits', count: (c) => (c.digits ? `${c.digits} cells` : null) },
      { id: 'kinds', name: 'Kind', route: 'b/kinds', count: (c) => (c.kind ? `${c.kind} without a kind` : null) },
      {
        id: 'doubtful',
        name: 'Doubtful labels',
        route: 'b/doubtful',
        count: (c) => (c.doubtful ? `${c.doubtful} to check` : null),
        idle: (c) => (c.doubtful === null ? 'Not computed in this run' : 'Done'),
      },
      { ...finish, route: 'b/finish' },
    ],
  },
}

/** The first step with open work, or Finish. The Fetch step is never the next step by itself. */
export function nextStep(flow: FlowId, counts: StartCounts): Step {
  const steps = FLOWS[flow].steps
  return steps.find((s) => s.id !== 'fetch' && s.count(counts) !== null) ?? steps[steps.length - 1]!
}
