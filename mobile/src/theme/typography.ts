import type { TypeRole } from './theme.types'

export type RoleFont = {
  fontFamily: string
  fontWeight: TypeRole['weight']
  textTransform?: 'uppercase'
  textShadowColor?: string
  textShadowOffset?: { width: number; height: number }
  textShadowRadius?: number
}

/** The family, weight, case and text shadow of a type role. The size stays with the caller: a grid digit scales with its cell. */
export function roleFont(role: TypeRole): RoleFont {
  const font: RoleFont = { fontFamily: role.family, fontWeight: role.weight }
  if (role.uppercase) font.textTransform = 'uppercase'
  if (role.textShadow == null) return font
  return {
    ...font,
    textShadowColor: role.textShadow.color,
    textShadowOffset: role.textShadow.offset,
    textShadowRadius: role.textShadow.radius,
  }
}

/** roleFont with the size and the letter spacing of the role, for text that does not scale. */
export function roleText(role: TypeRole): RoleFont & { fontSize: number; letterSpacing: number } {
  return { ...roleFont(role), fontSize: role.scale, letterSpacing: role.scale * role.tracking }
}

/** roleFont with the size of the role, for text that does not need the letter spacing. */
export function roleSized(role: TypeRole): RoleFont & { fontSize: number } {
  return { ...roleFont(role), fontSize: role.scale }
}
