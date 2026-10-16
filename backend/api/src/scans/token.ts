import { jwtVerify, type JWTVerifyGetKey } from 'jose'

// Throws for any token that is not valid. Returns the sub claim (ADR-027 decision 1: issuer and audience are exact).
export function createTokenVerifier(options: {
  issuer: string
  audience: string
  keys: JWTVerifyGetKey
}): (token: string) => Promise<string> {
  return async (token) => {
    const { payload } = await jwtVerify(token, options.keys, { issuer: options.issuer, audience: options.audience })
    if (typeof payload.sub !== 'string' || payload.sub === '') throw new Error('The token has no sub.')
    return payload.sub
  }
}
