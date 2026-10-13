import { INTRO_FADE_MS, INTRO_STEP_MS, INTRO_SWEEP_DELAY_MS } from '@/game/constants/intro.constants'
import { daylight } from '@/theme/themes/daylight'
import { introCellAlpha, introDuration, introLook } from './intro.utils'

const look = introLook(daylight, false)
const reduced = introLook(daylight, true)

test('the digits sweep in diagonal by diagonal from the top left', () => {
  const firstStart = INTRO_SWEEP_DELAY_MS
  expect(introCellAlpha(firstStart, 0, look)).toBe(0)
  expect(introCellAlpha(firstStart + INTRO_FADE_MS, 0, look)).toBe(1)
  // The bottom right cell has not started when the top left cell is in.
  expect(introCellAlpha(firstStart + INTRO_FADE_MS, 16, look)).toBe(0)
  expect(introCellAlpha(firstStart + 16 * INTRO_STEP_MS + INTRO_FADE_MS, 16, look)).toBe(1)
})

test('with Reduce Motion, every digit fades in at once over the short motion', () => {
  const half = daylight.motion.short / 2
  expect(introCellAlpha(half, 0, reduced)).toBe(introCellAlpha(half, 16, reduced))
  expect(introCellAlpha(half, 0, reduced)).toBeGreaterThan(0.5)
  expect(introCellAlpha(daylight.motion.short, 16, reduced)).toBe(1)
})

test('the entrance ends when the last digit is in', () => {
  for (const timing of [look, reduced]) {
    const end = introDuration(timing)
    for (let diagonal = 0; diagonal <= 16; diagonal += 1) expect(introCellAlpha(end, diagonal, timing)).toBe(1)
  }
})
