import { IdentityContext, JwtVerificationPoolConfig } from '../types/routes.js';
import { verifyJwt } from './jwt-verifier.js';

/**
 * Options for extractIdentity when using JWT verification
 */
export interface ExtractIdentityOptions {
  autoExtract?: boolean;
  jwtVerificationConfig?: JwtVerificationPoolConfig;
}

/**
 * Extracts identity context from API Gateway authorizer claims
 * Supports multiple API Gateway formats:
 * - REST API with Cognito User Pool Authorizer
 * - HTTP API with JWT Authorizer
 * - REST API with Custom Lambda Authorizer
 * - HTTP API with Lambda Authorizer
 */

/**
 * Extracts claims from the authorizer context, handling multiple API Gateway formats
 * @param authorizer - The authorizer object from requestContext
 * @returns Claims object or undefined
 */
function extractClaims(authorizer: any): Record<string, any> | undefined {
  if (!authorizer) return undefined;

  // 1. REST API with Cognito User Pool Authorizer: authorizer.claims
  if (authorizer.claims && typeof authorizer.claims === 'object') {
    return authorizer.claims;
  }

  // 2. HTTP API with JWT Authorizer: authorizer.jwt.claims
  if (authorizer.jwt?.claims && typeof authorizer.jwt.claims === 'object') {
    return authorizer.jwt.claims;
  }

  // 3. HTTP API with Lambda Authorizer: authorizer.lambda
  if (authorizer.lambda && typeof authorizer.lambda === 'object') {
    return authorizer.lambda;
  }

  // 4. REST API with Custom Lambda Authorizer: claims directly in authorizer
  // Check if authorizer has identity-like properties (sub, userId, email, etc.)
  if (hasIdentityProperties(authorizer)) {
    return authorizer;
  }

  return undefined;
}

/**
 * Checks if an object has identity-like properties
 */
function hasIdentityProperties(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const identityKeys = ['sub', 'userId', 'user_id', 'email', 'cognito:username', 'iss', 'aud'];
  return identityKeys.some(key => key in obj);
}

/**
 * Extracts identity information from the event's authorizer context or Authorization header.
 * When jwtVerificationConfig is provided, JWT signatures are cryptographically verified
 * against the Cognito JWKS endpoint. Without it, identity is only extracted from
 * API Gateway authorizer claims (already verified by API Gateway).
 *
 * @param event - Raw API Gateway event
 * @param optionsOrAutoExtract - Boolean for backwards compatibility, or ExtractIdentityOptions
 * @returns Identity context or undefined if not authenticated
 */
export async function extractIdentity(event: any, optionsOrAutoExtract?: boolean | ExtractIdentityOptions): Promise<IdentityContext | undefined> {
  const options: ExtractIdentityOptions = typeof optionsOrAutoExtract === 'boolean'
    ? { autoExtract: optionsOrAutoExtract }
    : optionsOrAutoExtract ?? {};

  const { autoExtract = false, jwtVerificationConfig } = options;

  const authorizer = event?.requestContext?.authorizer;
  const claims = extractClaims(authorizer);

  // If authorizer claims exist, API Gateway already verified the token — use them directly
  if (claims) {
    return buildIdentity(claims);
  }

  // If autoExtract is enabled and jwtVerificationConfig is provided, verify the Authorization header
  if (autoExtract && jwtVerificationConfig) {
    const authHeader = event?.headers?.authorization || event?.headers?.Authorization;
    if (authHeader) {
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const verifiedClaims = await verifyJwt(token, jwtVerificationConfig);
      if (verifiedClaims) {
        return buildIdentity(verifiedClaims);
      }
      // Verification failed → return undefined (caller will return 401)
      return undefined;
    }
  }

  return undefined;
}

/**
 * Builds an IdentityContext from raw claims
 */
function buildIdentity(claims: Record<string, any>): IdentityContext {
  return {
    userId: claims.userId || claims.user_id || claims['cognito:username'] || claims.sub,
    email: claims.email,
    groups: parseGroups(claims['cognito:groups'] || claims.groups),
    issuer: claims.iss,
    claims,
  };
}

/**
 * Parses Cognito groups from claims
 * Groups can come as a string or array depending on configuration
 */
function parseGroups(groups: string | string[] | undefined): string[] {
  if (!groups) return [];
  if (Array.isArray(groups)) return groups;
  
  // Cognito sometimes sends groups as a comma-separated string
  return groups.split(',').map(g => g.trim()).filter(Boolean);
}

/**
 * Extracts the User Pool ID from the issuer URL
 * @param issuer - Cognito issuer URL (e.g., https://cognito-idp.us-east-1.amazonaws.com/us-east-1_xxxxx)
 * @returns User Pool ID or undefined
 */
export function extractUserPoolId(issuer: string | undefined): string | undefined {
  if (!issuer) return undefined;
  
  // Extract the last segment of the issuer URL
  const parts = issuer.split('/');
  return parts[parts.length - 1];
}

/**
 * Validates that the token issuer matches the expected User Pool
 * @param identity - Extracted identity context
 * @param expectedUserPoolId - Expected User Pool ID
 * @returns True if issuer matches
 */
export function validateIssuer(identity: IdentityContext | undefined, expectedUserPoolId: string): boolean {
  if (!identity?.issuer) return false;
  
  const actualUserPoolId = extractUserPoolId(identity.issuer);
  return actualUserPoolId === expectedUserPoolId;
}

/**
 * Checks if the user belongs to any of the specified groups
 * @param identity - Extracted identity context
 * @param allowedGroups - Groups that grant access
 * @returns True if user is in at least one allowed group
 */
export function hasAnyGroup(identity: IdentityContext | undefined, allowedGroups: string[]): boolean {
  if (!identity?.groups || identity.groups.length === 0) return false;
  
  return allowedGroups.some(group => identity.groups?.includes(group));
}

/**
 * Checks if the user belongs to all specified groups
 * @param identity - Extracted identity context
 * @param requiredGroups - Groups required for access
 * @returns True if user is in all required groups
 */
export function hasAllGroups(identity: IdentityContext | undefined, requiredGroups: string[]): boolean {
  if (!identity?.groups || identity.groups.length === 0) return false;
  
  return requiredGroups.every(group => identity.groups?.includes(group));
}
