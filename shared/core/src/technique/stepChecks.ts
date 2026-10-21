import { expect } from 'vitest'
import type { Step } from './types'

function isSortedAndUnique(values: readonly number[]): boolean {
  return values.every((value, i) => i === 0 || values[i - 1]! < value)
}

const WINGS: ReadonlySet<Step['technique']> = new Set(['xyWing', 'xyzWing', 'wWing'])

/** Wings list the pivot first and the removed digit first. Every other list is sorted. */
export function expectWellFormed(step: Step): void {
  const unordered = WINGS.has(step.technique)
  expect(step.units.length).toBeGreaterThan(0)
  expect(new Set(step.units).size).toBe(step.units.length)
  expect(step.units.every((unit) => unit >= 0 && unit < 27)).toBe(true)
  if (unordered) {
    expect(new Set(step.pattern).size).toBe(step.pattern.length)
    expect(new Set(step.digits).size).toBe(step.digits.length)
  } else {
    expect(isSortedAndUnique(step.pattern)).toBe(true)
    expect(isSortedAndUnique(step.digits)).toBe(true)
  }
  expect(isSortedAndUnique(step.support)).toBe(true)
}
