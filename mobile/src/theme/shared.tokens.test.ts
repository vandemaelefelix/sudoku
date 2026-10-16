import { SHARED_OPACITY, SHARED_SIZE, SHARED_TYPE } from './shared.tokens'

it('keeps every button and key at 44 pt or more', () => {
  expect(SHARED_SIZE.touch).toBe(44)
  for (const side of [SHARED_SIZE.tool, SHARED_SIZE.key.width, SHARED_SIZE.key.height]) {
    expect(side).toBeGreaterThanOrEqual(SHARED_SIZE.touch)
  }
})

it('fits an icon inside a touch target', () => {
  expect(SHARED_SIZE.icon).toBeLessThanOrEqual(SHARED_SIZE.touch)
})

it('keeps the opacities between 0 and 1', () => {
  for (const opacity of Object.values(SHARED_OPACITY)) {
    expect(opacity).toBeGreaterThan(0)
    expect(opacity).toBeLessThan(1)
  }
})

it('gives the section role a letter spacing and every other role none', () => {
  const { section, ...others } = SHARED_TYPE
  expect(section.tracking).toBeGreaterThan(0)
  for (const role of Object.values(others)) expect(role.tracking).toBe(0)
})
