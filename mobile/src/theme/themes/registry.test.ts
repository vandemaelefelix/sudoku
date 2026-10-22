import { COLOUR_THEMES, THEME_NAMES, THEMES } from './registry'

describe('the theme registry', () => {
  it('has three colourways, each in Light and in Colour', () => {
    expect(THEME_NAMES).toEqual(['cobalt', 'forest', 'bordeaux'])
    expect(Object.keys(COLOUR_THEMES)).toEqual(THEME_NAMES)
    for (const name of THEME_NAMES) {
      expect(THEMES[name].appearance).toBe('light')
      expect(COLOUR_THEMES[name].appearance).toBe('colour')
    }
  })

  it('gives each of the six themes its colourway name, its appearance and one label per colourway', () => {
    const six = [...Object.values(THEMES), ...Object.values(COLOUR_THEMES)]
    expect(new Set(six.map((theme) => `${theme.name}/${theme.appearance}`)).size).toBe(6)
    for (const theme of six) {
      expect(theme.label).toBe(THEMES[theme.name].label)
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

  it('marks the selected cell with a tile of the strongest tint in Light and a white tint of the page in Colour', () => {
    for (const name of THEME_NAMES) {
      expect(THEMES[name].components.cell.ring).toBe(THEMES[name].colors.accent)
      const colour = COLOUR_THEMES[name].components.cell
      expect(colour.ring).toBe('#ffffff')
      expect(colour.selectedTile).not.toBe('#ffffff')
      expect(colour.selected).not.toBe('#ffffff')
      expect(colour.given).toBe('#ffffff')
    }
  })

  it('derives the Colour page from the accent: the same hue, darker', () => {
    expect(COLOUR_THEMES.cobalt.colors.background).toBe('#162c92')
    expect(COLOUR_THEMES.forest.colors.background).toBe('#0e432a')
    expect(COLOUR_THEMES.bordeaux.colors.background).toBe('#560f22')
  })

  it('types the entries of Colour with the light tint of each colourway', () => {
    expect(COLOUR_THEMES.cobalt.components.cell.entry).toBe('#e0e7ff')
    expect(COLOUR_THEMES.forest.components.cell.entry).toBe('#c9f6dc')
    expect(COLOUR_THEMES.bordeaux.components.cell.entry).toBe('#ffd9e4')
  })

  it('marks a conflict in Colour with an amber hatch over the peer fill and an amber digit, the same in every colourway', () => {
    for (const name of THEME_NAMES) {
      const { cell, checkRing } = COLOUR_THEMES[name].components
      expect(cell.conflictFill).toBe(cell.peer)
      expect(cell.conflict).toBe('#ffc94d')
      expect(cell.conflictHatch).toEqual({ color: '#ffc94d', opacity: 0.25, width: 1.6, pitch: 5 })
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
