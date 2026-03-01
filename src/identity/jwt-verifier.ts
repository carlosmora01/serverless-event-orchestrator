import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { JwtVerificationPoolConfig } from '../types/routes.js';

/**
 * Module-level cache of CognitoJwtVerifier instances keyed by userPoolId.
 * Persists across Lambda warm invocations. Each verifier internally caches JWKS.
 */
const verifierCache = new Map<string, ReturnType<typeof CognitoJwtVerifier.create>>();

function getVerifier(poolConfig: JwtVerificationPoolConfig) {
  const cacheKey = poolConfig.userPoolId;

  if (!verifierCache.has(cacheKey)) {
    const verifier = CognitoJwtVerifier.create({
      userPoolId: poolConfig.userPoolId,
      clientId: poolConfig.clientId ?? null,
      tokenUse: poolConfig.tokenUse ?? null,
    });
    verifierCache.set(cacheKey, verifier);
  }

  return verifierCache.get(cacheKey)!;
}

/**
 * Verifies a JWT token against a Cognito User Pool's JWKS.
 * Returns the verified payload (claims) or undefined if verification fails.
 */
export async function verifyJwt(
  token: string,
  poolConfig: JwtVerificationPoolConfig
): Promise<Record<string, any> | undefined> {
  try {
    const verifier = getVerifier(poolConfig);
    const payload = await verifier.verify(token);
    return payload as unknown as Record<string, any>;
  } catch (error: any) {
    console.error('[SEO] JWT verification failed:', error?.message || error);
    return undefined;
  }
}
