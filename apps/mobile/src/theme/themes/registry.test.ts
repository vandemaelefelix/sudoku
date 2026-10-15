import { APPEARANCES, COLOUR_THEMES, THEME_NAMES, THEMES, themeFor } from './registry'

describe('the theme registry', () => {
  it('has three colourways, each in Light and in Colour', () => {
    expect(THEME_NAMES).toEqual(['cobalt', 'forest', 'bordeaux'])
    expect(APPEARANCES).toEqual(['light', 'colour'])
    for (const name of THEME_NAMES) {
      expect(themeFor(name, 'light')).toBe(THEMES[name])
      expect(themeFor(name, 'colour')).toBe(COLOUR_THEMES[name])
    }
  })

  it('gives each of the six themes its colourway name, its appearance and one label per colourway', () => {
    const six = APPEARANCES.flatMap((appearance) => THEME_NAMES.map((name) => themeFor(name, appearance)))
    expect(new Set(six.map((theme) => `${theme.name}/${theme.appearance}`)).size).toBe(6)
    for (const theme of six) {
      expect(theme.label).toBe(themeFor(theme.name, 'light').label)
    }
  })

  it('has the light status bar text on a Colour theme and the dark text on a Light theme', () => {
    for (const name of THEME_NAMES) {
      expect(THEMES[name].statusBar).toBe('dark')
      expect(COLOUR_THEMES[name].statusBar).toBe('light')
    }
  })

  it('draws white scroll bars on a Colour theme and black ones on a Light theme', () => {
    for (const name of THEME_NAMES) {
      expect(THEMES[name].scrollIndicator).toBe('black')
      expect(COLOUR_THEMES[name].scrollIndicator).toBe('white')
    }
  })

  it('shares the type, the sizes and the shape between the two appearances of a colourway', () => {
    for (const name of THEME_NAMES) {
      const light = THEMES[name]
      const colour = COLOUR_THEMES[name]
      expect(colour.type).toEqual(light.type)
      expect(colour.size).toEqual(light.size)
      expect(colour.shape).toEqual(light.shape)
      expect(colour.space).toEqual(light.space)
    }
  })

  it('rings the selected cell in Colour only, with a lighter tint of the page as its fill', () => {
    for (const name of THEME_NAMES) {
      expect(THEMES[name].components.cell.selectedRingWidth).toBe(0)
      const colour = COLOUR_THEMES[name].components.cell
      expect(colour.selectedRingWidth).toBe(2)
      expect(colour.ring).toBe('#ffffff')
      expect(colour.selected).not.toBe('#ffffff')
      expect(colour.given).toBe('#ffffff')
    }
  })

  it('derives the Colour page from the accent: the same hue, darker', () => {
    expect(COLOUR_THEMES.cobalt.colors.background).toBe('#1a35b0')
    expect(COLOUR_THEMES.forest.colors.background).toBe('#115132')
    expect(COLOUR_THEMES.bordeaux.colors.background).toBe('#671229')
  })

  it('types the entries of Colour with the light tint of each colourway', () => {
    expect(COLOUR_THEMES.cobalt.components.cell.entry).toBe('#e0e7ff')
    expect(COLOUR_THEMES.forest.components.cell.entry).toBe('#c9f6dc')
    expect(COLOUR_THEMES.bordeaux.components.cell.entry).toBe('#ffd9e4')
  })

  it('marks a conflict in Colour with a hatch over the peer fill and a white digit, the same in every colourway', () => {
    for (const name of THEME_NAMES) {
      const { cell, checkRing } = COLOUR_THEMES[name].components
      expect(cell.conflictFill).toBe(cell.peer)
      expect(cell.conflict).toBe('#ffffff')
      expect(cell.conflictHatch).toEqual({ color: '#ffffff', opacity: 0.2, width: 1.6, pitch: 5 })
      expect(checkRing.color).not.toBe(cell.conflictFill)
    }
  })

  it('marks a conflict in Light with the danger fill and no hatch', () => {
    for (const name of THEME_NAMES) {
      const { cell } = THEMES[name].components
      expect(cell.conflictFill).toBe(THEMES[name].colors.dangerSurface)
      expect(cell.conflictHatch).toBeNull()
    }
  })
})
