import { EXIT_END_MS } from '@/splash/constants/splash.constants'
import { cellPassed, glow, splashGrid } from '@/splash/utils/splash.utils'
import { TRANSITION_MS } from './transition.constants'
import { splashMs } from './transition.utils'

const SIZES = [
  [375, 667],
  [390, 844],
  [430, 932],
] as const

it('plays the whole splash wave once in about 700 ms', () => {
  expect(TRANSITION_MS).toBeGreaterThanOrEqual(650)
  expect(TRANSITION_MS).toBeLessThanOrEqual(750)
  expect(splashMs(0)).toBe(0)
  expect(splashMs(-5)).toBe(0)
  expect(splashMs(TRANSITION_MS)).toBeCloseTo(EXIT_END_MS, 9)
})

it('starts with the old screen untouched: no cell shows and none erases the picture', () => {
  for (const [width, height] of SIZES) {
    for (const { delayMs } of splashGrid(width, height).cells) {
      expect(glow(splashMs(0) - delayMs)).toBe(0)
      expect(cellPassed(splashMs(0) - delayMs)).toBe(false)
    }
  }
})

it('ends with nothing of the picture left: every cell has erased it and no cell is still drawn', () => {
  for (const [width, height] of SIZES) {
    for (const { delayMs } of splashGrid(width, height).cells) {
      expect(cellPassed(splashMs(TRANSITION_MS) - delayMs)).toBe(true)
      expect(glow(splashMs(TRANSITION_MS) - delayMs)).toBe(0)
    }
  }
})

it('erases the picture row by row from the bottom, never in a cell that the wave has not reached', () => {
  const { cells } = splashGrid(390, 844)
  const now = splashMs(TRANSITION_MS / 2)
  const erased = cells.filter(({ delayMs }) => cellPassed(now - delayMs))
  const kept = cells.filter(({ delayMs }) => !cellPassed(now - delayMs))
  expect(erased.length).toBeGreaterThan(0)
  expect(kept.length).toBeGreaterThan(0)
  // Rows count down from the top (j < 0) to the bottom (j > 0). The lowest erased row is under the highest kept one.
  expect(Math.max(...erased.map(({ j }) => j))).toBe(10)
  expect(Math.min(...kept.map(({ j }) => j))).toBe(-10)
  expect(Math.min(...erased.map(({ j }) => j))).toBeGreaterThan(-10)
})

it('has every cell solid at the moment it erases the picture, so the erase shows no pop', () => {
  for (const { delayMs } of splashGrid(390, 844).cells) {
    let first = -1
    for (let ms = 0; ms < EXIT_END_MS; ms += 1) {
      if (cellPassed(ms - delayMs)) {
        first = ms
        break
      }
    }
    expect(glow(first - delayMs)).toBeGreaterThan(0.99)
  }
})
