import {
  EXIT_END_MS,
  GLOW_MS,
  GLOW_PEAK_AT,
  GROUND_FADE_MS,
  HOLD_MS,
  INTRO_END_MS,
  LETTER_RISE_BY,
  LETTER_RISE_MS,
  LETTER_STEP_MS,
  REVEAL_BAND,
  REVEAL_LAG_MS,
  WORD_FADE_MS,
  WORD_FADE_START_MS,
  WORD_RISE_BY,
} from '@/splash/constants/splash.constants'
import {
  cellJitter,
  cellPassed,
  glow,
  groundEdge,
  groundFade,
  letterRise,
  splashDigit,
  splashGrid,
  wordFade,
} from './splash.utils'

describe('timing', () => {
  it('ends the intro when the last letter is at rest', () => {
    expect(INTRO_END_MS).toBe(925)
  })

  it('ends the word fade before the exit ends', () => {
    expect(WORD_FADE_START_MS + WORD_FADE_MS).toBeLessThanOrEqual(EXIT_END_MS)
  })
})

describe('cellJitter', () => {
  it('gives the same value for the same cell, on every call', () => {
    expect(cellJitter(0, 0)).toBe(cellJitter(0, 0))
    expect(cellJitter(0, 0)).toBeCloseTo(0.6472863, 6)
    expect(cellJitter(1, 2)).toBeCloseTo(0.8430697, 6)
  })

  it('stays from 0 up to, not including, 1', () => {
    for (let j = -12; j <= 12; j++) {
      for (let i = -4; i <= 4; i++) {
        expect(cellJitter(i, j)).toBeGreaterThanOrEqual(0)
        expect(cellJitter(i, j)).toBeLessThan(1)
      }
    }
  })
})

describe('splashGrid', () => {
  it('fills a 390 × 844 window with 9 columns and 21 rows around the centre', () => {
    const { size, cells } = splashGrid(390, 844)
    expect(size).toBeCloseTo(43.3333, 4)
    expect(cells).toHaveLength(9 * 21)
    expect(Math.min(...cells.map((cell) => cell.i))).toBe(-4)
    expect(Math.max(...cells.map((cell) => cell.i))).toBe(4)
    expect(Math.min(...cells.map((cell) => cell.j))).toBe(-10)
    expect(Math.max(...cells.map((cell) => cell.j))).toBe(10)
  })

  it('covers the window on the other sizes', () => {
    expect(splashGrid(375, 667).cells).toHaveLength(9 * 17)
    expect(splashGrid(430, 932).cells).toHaveLength(9 * 21)
    for (const [width, height] of [
      [375, 667],
      [390, 844],
      [430, 932],
    ] as const) {
      const { size, cells } = splashGrid(width, height)
      const top = Math.min(...cells.map((cell) => height / 2 + (cell.j - 0.5) * size))
      const bottom = Math.max(...cells.map((cell) => height / 2 + (cell.j + 0.5) * size))
      expect(top).toBeLessThanOrEqual(0)
      expect(bottom).toBeGreaterThanOrEqual(height)
    }
  })

  it('starts the bottom row first and the top row last, with a jitter of up to 120 ms', () => {
    const { cells } = splashGrid(390, 844)
    const bottom = cells.filter((cell) => cell.j === 10).map((cell) => cell.delayMs)
    const top = cells.filter((cell) => cell.j === -10).map((cell) => cell.delayMs)
    expect(Math.max(...bottom)).toBeLessThan(120)
    expect(Math.min(...top)).toBeGreaterThanOrEqual(420)
    expect(Math.max(...top)).toBeLessThan(540)
  })

  it('gives the centre cell a fixed delay', () => {
    const centre = splashGrid(390, 844).cells.find((cell) => cell.i === 0 && cell.j === 0)
    expect(centre?.delayMs).toBeCloseTo(21 * 10 + 120 * 0.6472863, 3)
  })

  it('ends every cell before the exit ends, on every size', () => {
    for (const [width, height] of [
      [375, 667],
      [390, 844],
      [430, 932],
    ] as const) {
      const last = Math.max(...splashGrid(width, height).cells.map((cell) => cell.delayMs))
      expect(last + GLOW_MS).toBeLessThan(EXIT_END_MS)
    }
  })
})

describe('glow', () => {
  it('is 0 before the start and after the end', () => {
    expect(glow(-5)).toBe(0)
    expect(glow(0)).toBe(0)
    expect(glow(GLOW_MS)).toBe(0)
    expect(glow(GLOW_MS + 100)).toBe(0)
  })

  it('peaks at 30 % of the time and falls on both sides', () => {
    expect(glow(GLOW_MS * 0.3)).toBeCloseTo(1, 12)
    expect(glow(GLOW_MS * 0.15)).toBeCloseTo(Math.SQRT1_2, 12)
    expect(glow(GLOW_MS * 0.65)).toBeCloseTo(Math.SQRT1_2, 12)
  })
})

describe('letterRise', () => {
  it('keeps a letter hidden and low until its turn', () => {
    expect(letterRise(0, 0)).toEqual({ opacity: 0, translateY: LETTER_RISE_BY })
    expect(letterRise(HOLD_MS + 5 * LETTER_STEP_MS, 5)).toEqual({ opacity: 0, translateY: LETTER_RISE_BY })
  })

  it('puts every letter at rest when the intro ends', () => {
    for (let index = 0; index < 6; index++) {
      expect(letterRise(INTRO_END_MS, index)).toEqual({ opacity: 1, translateY: 0 })
    }
  })

  it('moves a letter most of the way in half of its time', () => {
    const half = letterRise(HOLD_MS + LETTER_RISE_MS / 2, 0)
    expect(half.opacity).toBeCloseTo(0.96875, 12)
    expect(half.translateY).toBeCloseTo(LETTER_RISE_BY * 0.03125, 12)
  })

  it('starts each letter 45 ms after the one before it', () => {
    expect(letterRise(HOLD_MS + LETTER_STEP_MS, 1).opacity).toBe(0)
    expect(letterRise(HOLD_MS + LETTER_STEP_MS + 1, 1).opacity).toBeGreaterThan(0)
  })
})

describe('wordFade', () => {
  it('holds the word at rest until the fade starts and gone after it ends', () => {
    expect(wordFade(WORD_FADE_START_MS)).toEqual({ opacity: 1, translateY: -0 })
    expect(wordFade(WORD_FADE_START_MS + WORD_FADE_MS)).toEqual({ opacity: 0, translateY: -WORD_RISE_BY })
  })

  it('is half faded and half risen in the middle', () => {
    const middle = wordFade(WORD_FADE_START_MS + WORD_FADE_MS / 2)
    expect(middle.opacity).toBeCloseTo(0.5, 12)
    expect(middle.translateY).toBeCloseTo(-WORD_RISE_BY / 2, 12)
  })
})

describe('groundEdge', () => {
  it('starts under the window and waits for the lag', () => {
    expect(groundEdge(0, 844, 43.3)).toBeGreaterThan(844)
    expect(groundEdge(REVEAL_LAG_MS, 844, 43.3)).toBe(groundEdge(0, 844, 43.3))
  })

  it('has cleared the whole window, band included, before the exit ends, on every size', () => {
    for (const [width, height] of [
      [375, 667],
      [390, 844],
      [430, 932],
    ] as const) {
      expect(groundEdge(EXIT_END_MS, height, width / 9) + REVEAL_BAND).toBeLessThanOrEqual(0)
    }
  })
})

describe('cellPassed', () => {
  it('is false before the peak of the glow and true from it, when the cell is solid', () => {
    expect(cellPassed(-1)).toBe(false)
    expect(cellPassed(0)).toBe(false)
    expect(cellPassed(GLOW_MS * GLOW_PEAK_AT - 0.001)).toBe(false)
    expect(cellPassed(GLOW_MS * GLOW_PEAK_AT)).toBe(true)
    expect(glow(GLOW_MS * GLOW_PEAK_AT)).toBeCloseTo(1, 12)
    expect(cellPassed(GLOW_MS + 100)).toBe(true)
  })
})

describe('groundFade', () => {
  it('starts with none of the page colour, so the first frame is the white of the native splash', () => {
    expect(groundFade(0)).toBe(0)
  })

  it('has covered the white by GROUND_FADE_MS, before the first letter', () => {
    expect(groundFade(GROUND_FADE_MS)).toBe(1)
    expect(groundFade(INTRO_END_MS)).toBe(1)
    expect(GROUND_FADE_MS).toBeLessThanOrEqual(HOLD_MS)
  })

  it('eases out: more than half is done in a third of the time, and it only rises', () => {
    expect(groundFade(GROUND_FADE_MS / 3)).toBeGreaterThan(0.5)
    let last = 0
    for (let ms = 0; ms <= GROUND_FADE_MS; ms += 10) {
      expect(groundFade(ms)).toBeGreaterThanOrEqual(last)
      last = groundFade(ms)
    }
  })
})

describe('splashDigit', () => {
  it('gives the same digit for the same cell, from 1 to 9 or none', () => {
    for (let j = -12; j <= 12; j++) {
      for (let i = -4; i <= 4; i++) {
        const digit = splashDigit(i, j)
        expect(digit).toBe(splashDigit(i, j))
        expect(digit ?? 1).toBeGreaterThanOrEqual(1)
        expect(digit ?? 9).toBeLessThanOrEqual(9)
      }
    }
  })

  it('shows a digit in about half of the cells, so the grid looks like a puzzle', () => {
    let shown = 0
    let total = 0
    for (let j = -10; j <= 10; j++) {
      for (let i = -4; i <= 4; i++) {
        total++
        if (splashDigit(i, j) != null) shown++
      }
    }
    expect(shown / total).toBeGreaterThan(0.3)
    expect(shown / total).toBeLessThan(0.6)
  })

  it('never repeats a digit in a row of 9 cells', () => {
    for (let j = -10; j <= 10; j++) {
      const digits: number[] = []
      for (let i = -4; i <= 4; i++) {
        const digit = splashDigit(i, j)
        if (digit != null) digits.push(digit)
      }
      expect(new Set(digits).size).toBe(digits.length)
    }
  })
})
