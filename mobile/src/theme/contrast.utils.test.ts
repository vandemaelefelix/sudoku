import { contrastRatio } from './contrast.utils'

describe('contrastRatio', () => {
  it('gives 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#2f5bd3', '#2f5bd3')).toBeCloseTo(1, 5)
  })

  it('is symmetric', () => {
    expect(contrastRatio('#5c6475', '#f4f5f8')).toBeCloseTo(contrastRatio('#f4f5f8', '#5c6475'), 10)
  })

  it('matches the WCAG value of a known pair', () => {
    // WebAIM gives 4.54 for #767676 on white.
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })

  it('refuses a colour that is not #rrggbb', () => {
    expect(() => contrastRatio('rgba(0,0,0,1)', '#ffffff')).toThrow('#rrggbb')
  })
})
