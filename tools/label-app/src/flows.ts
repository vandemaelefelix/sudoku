import type { StartCounts } from './api/types'

export interface Step {
  id: string
  name: string
  route: string
  /** The open work of the step, in words. null: nothing waits. */
  count: (counts: StartCounts) => string | null
  /** What the start page shows when nothing waits. Default: "Done". */
  idle?: (counts: StartCounts) => string
}

export const FLOW = {
  name: 'Label new scans',
  about: 'Uploaded app scans, photos of just import-photos and loose cells.',
}

export const STEPS: Step[] = [
  { id: 'fetch', name: 'Fetch new scans', route: 'fetch', count: () => null, idle: () => 'Any time' },
  {
    id: 'outlines',
    name: 'Outlines',
    route: 'outlines',
    count: (c) => (c.outlines ? `${c.outlines} to check` : null),
  },
  {
    id: 'digits',
    name: 'Digits',
    route: 'digits',
    count: (c) => (c.digit_cells ? `${c.digit_cells} cells` : null),
  },
  {
    id: 'kinds',
    name: 'Kind',
    route: 'kinds',
    count: (c) => (c.kind_cells ? `${c.kind_cells} cells` : null),
  },
  {
    id: 'finish',
    name: 'Finish',
    route: 'finish',
    count: (c) => (c.changes ? `${c.changes} unfinished changes` : null),
    idle: () => 'Nothing to finish',
  },
]

/** The first step with open work, or Finish. The Fetch step is never the next step by itself. */
export function nextStep(counts: StartCounts): Step {
  return STEPS.find((s) => s.id !== 'fetch' && s.count(counts) !== null) ?? STEPS[STEPS.length - 1]!
}
