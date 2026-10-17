import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'
import { createTokenVerifier } from '../../src/scans/token'

const ISSUER = 'https://clerk.test'
const AUDIENCE = 'sudoku-api'

describe('createTokenVerifier', () => {
  let sign: (claims: { sub?: string; iss?: string; aud?: string; exp?: string | number }) => Promise<string>
  let verify: (token: string) => Promise<string>

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256')
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' }
    verify = createTokenVerifier({ issuer: ISSUER, audience: AUDIENCE, keys: createLocalJWKSet({ keys: [jwk] }) })
    sign = ({ sub = 'user_1', iss = ISSUER, aud = AUDIENCE, exp = '5m' }) =>
      new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setSubject(sub)
        .setIssuer(iss)
        .setAudience(aud)
        .setExpirationTime(exp)
        .sign(privateKey)
  })

  it('returns the sub of a valid token', async () => {
    expect(await verify(await sign({}))).toBe('user_1')
  })

  it('refuses an expired token', async () => {
    await expect(verify(await sign({ exp: Math.floor(Date.now() / 1000) - 3600 }))).rejects.toThrow(/.+/)
  })

  it('refuses a wrong issuer and a wrong audience', async () => {
    await expect(verify(await sign({ iss: 'https://evil.test' }))).rejects.toThrow(/.+/)
    await expect(verify(await sign({ aud: 'other' }))).rejects.toThrow(/.+/)
  })

  it('refuses a token that is not a JWT', async () => {
    await expect(verify('nonsense')).rejects.toThrow(/.+/)
  })
})
