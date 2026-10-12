import { roleFont } from './typography'
import { daylight } from '@/theme/themes/daylight'

describe('roleFont', () => {
  it('gives the family and the weight of a role without a shadow', () => {
    expect(roleFont(daylight.type.given)).toEqual({ fontFamily: 'System', fontWeight: '600' })
  })

  it('adds the text shadow of a role that has one', () => {
    const shadow = { color: daylight.colors.shadow, offset: { width: 0, height: 1 }, radius: 2 }
    expect(roleFont({ ...daylight.type.given, textShadow: shadow })).toMatchObject({
      textShadowColor: daylight.colors.shadow,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    })
  })
})
