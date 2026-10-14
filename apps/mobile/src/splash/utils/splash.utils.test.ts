import { styles as menuStyles } from '@/home/components/HomeMenu/HomeMenu.styles'
import { daylight } from '@/theme/themes/daylight'
import {
  EXIT_END_MS,
  GLIDE_MS,
  GLIDE_START_MS,
  GLOW_MS,
  GROUND_FADE_END_MS,
  GROUND_FADE_START_MS,
  HANDOFF_AT_MS,
  HANDOFF_MS,
  HOLD_MS,
  INTRO_END_MS,
  LETTER_RISE_BY,
  LETTER_RISE_MS,
  LETTER_STEP_MS,
} from '@/splash/constants/splash.constants'
import {
  cellJitter,
  glide,
  glow,
  groundOpacity,
  letterRise,
  splashGrid,
  titleOrigin,
  wordOpacity,
} from './splash.utils'

describe('timing', () => {
  it('ends the intro when the last letter is at rest', () => {
    expect(INTRO_END_MS).toBe(925)
  })

  it('hands off after the glide and ends after the hand-off', () => {
    expect(GLIDE_START_MS + GLIDE_MS).toBeLessThan(HANDOFF_AT_MS)
    expect(HANDOFF_AT_MS + HANDOFF_MS).toBeLessThanOrEqual(EXIT_END_MS)
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
    expect(Math.min(...top)).toBeGreaterThanOrEqual(600)
    expect(Math.max(...top)).toBeLessThan(720)
  })

  it('gives the centre cell a fixed delay', () => {
    const centre = splashGrid(390, 844).cells.find((cell) => cell.i === 0 && cell.j === 0)
    expect(centre?.delayMs).toBeCloseTo(30 * 10 + 120 * 0.6472863, 3)
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

  it('clears every cell under the title before the hand-off, on every size', () => {
    for (const [width, height, insetTop] of [
      [375, 667, 20],
      [390, 844, 59],
      [430, 932, 59],
    ] as const) {
      const { size, cells } = splashGrid(width, height)
      const titleTop = insetTop + 32
      const titleBottom = titleTop + 34
      const under = cells.filter((cell) => {
        const centre = height / 2 + cell.j * size
        return centre + size / 2 > titleTop && centre - size / 2 < titleBottom
      })
      expect(under.length).toBeGreaterThan(0)
      expect(Math.max(...under.map((cell) => cell.delayMs + GLOW_MS))).toBeLessThan(HANDOFF_AT_MS)
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

describe('glide, groundOpacity and wordOpacity', () => {
  it('holds the word in the middle until the glide starts and at the title after it ends', () => {
    expect(glide(0)).toBe(0)
    expect(glide(GLIDE_START_MS)).toBe(0)
    expect(glide(GLIDE_START_MS + GLIDE_MS / 2)).toBeCloseTo(0.5, 12)
    expect(glide(GLIDE_START_MS + GLIDE_MS)).toBe(1)
    expect(glide(EXIT_END_MS)).toBe(1)
  })

  it('fades the ground from 100 ms to 800 ms', () => {
    expect(groundOpacity(0)).toBe(1)
    expect(groundOpacity(GROUND_FADE_START_MS)).toBe(1)
    expect(groundOpacity((GROUND_FADE_START_MS + GROUND_FADE_END_MS) / 2)).toBeCloseTo(0.5, 12)
    expect(groundOpacity(GROUND_FADE_END_MS)).toBe(0)
  })

  it('fades the word out in the 100 ms of the hand-off', () => {
    expect(wordOpacity(HANDOFF_AT_MS)).toBe(1)
    expect(wordOpacity(HANDOFF_AT_MS + HANDOFF_MS / 2)).toBeCloseTo(0.5, 12)
    expect(wordOpacity(HANDOFF_AT_MS + HANDOFF_MS)).toBe(0)
  })
})

describe('titleOrigin', () => {
  it('puts the title at the left space and below the top inset', () => {
    expect(titleOrigin(daylight.space, 59)).toEqual({ x: 16, y: 59 + 32 })
  })

  it('matches the place of the title in the home menu', () => {
    // The Unistyles mock reports zero insets.
    const origin = titleOrigin(daylight.space, 0)
    expect(menuStyles.screen).toMatchObject({ paddingTop: origin.y, paddingHorizontal: origin.x })
  })
})
