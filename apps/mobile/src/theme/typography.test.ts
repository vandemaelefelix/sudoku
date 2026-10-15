import { roleFont } from './typography'
import { cobalt } from '@/theme/themes/cobalt'

describe('roleFont', () => {
  it('gives the family and the weight of a role without a shadow', () => {
    expect(roleFont(cobalt.type.given)).toEqual({
      fontFamily: cobalt.type.given.family,
      fontWeight: cobalt.type.given.weight,
    })
  })

  it('adds the text shadow of a role that has one', () => {
    const shadow = { color: cobalt.colors.shadow, offset: { width: 0, height: 1 }, radius: 2 }
    expect(roleFont({ ...cobalt.type.given, textShadow: shadow })).toMatchObject({
      textShadowColor: cobalt.colors.shadow,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    })
  })
})
