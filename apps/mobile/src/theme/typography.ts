import type { TypeRole } from './theme.types'

export type RoleFont = {
  fontFamily: string
  fontWeight: TypeRole['weight']
  textShadowColor?: string
  textShadowOffset?: { width: number; height: number }
  textShadowRadius?: number
}

/** The family, weight and text shadow of a type role. The size stays with the caller: a grid digit scales with its cell. */
export function roleFont(role: TypeRole): RoleFont {
  const font: RoleFont = { fontFamily: role.family, fontWeight: role.weight }
  if (role.textShadow == null) return font
  return {
    ...font,
    textShadowColor: role.textShadow.color,
    textShadowOffset: role.textShadow.offset,
    textShadowRadius: role.textShadow.radius,
  }
}
