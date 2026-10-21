import { bitCount } from '../bits'
import type { Candidates, Step } from './types'

function isSortedAndUnique(values: readonly number[]): boolean {
  return values.every((value, i) => i === 0 || values[i - 1]! < value)
}

// SUD-04: core imports no package, and only `*.test.ts` files are exempt. So this test helper throws instead of using `expect`.
function check(condition: boolean, rule: string, step: Step): void {
  if (!condition) throw new Error(`A ${step.technique} step breaks the rule: ${rule}. ${JSON.stringify(step)}`)
}

const WINGS: ReadonlySet<Step['technique']> = new Set(['xyWing', 'xyzWing', 'wWing'])

/**
 * Wings list the pivot first and the removed digit first. An XY-chain lists the removed digit first.
 * Every other list is sorted. The two colour groups are sorted too. Throws for a step that breaks a rule.
 */
export function expectWellFormed(step: Step, candidates?: Candidates): void {
  const unorderedPattern = WINGS.has(step.technique)
  const unorderedDigits = unorderedPattern || step.technique === 'xyChain'
  if (unorderedPattern) {
    for (const { digit } of step.eliminations) check(digit === step.digits[0], 'a wing removes its first digit', step)
    if (candidates && step.technique !== 'wWing') {
      const pivotSize = bitCount(candidates[step.pattern[0]!]!)
      check(pivotSize === (step.technique === 'xyWing' ? 2 : 3), 'the pivot comes first', step)
    }
  }
  check(step.units.length > 0, 'a step has a unit', step)
  check(new Set(step.units).size === step.units.length, 'the units are unique', step)
  check(
    step.units.every((unit) => unit >= 0 && unit < 27),
    'a unit is from 0 to 26',
    step,
  )
  if (unorderedPattern) check(new Set(step.pattern).size === step.pattern.length, 'the pattern cells are unique', step)
  else check(isSortedAndUnique(step.pattern), 'the pattern cells are sorted', step)
  if (unorderedDigits) check(new Set(step.digits).size === step.digits.length, 'the digits are unique', step)
  else check(isSortedAndUnique(step.digits), 'the digits are sorted', step)
  check(isSortedAndUnique(step.support), 'the support cells are sorted', step)
  for (const group of step.groups ?? []) check(isSortedAndUnique(group), 'a colour group is sorted', step)
  for (const link of step.links ?? []) check(step.pattern.includes(link.from), 'a link starts at a pattern cell', step)
}
