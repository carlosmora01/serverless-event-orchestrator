import { IdentityContext } from '../types/routes.js';

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
 * Extracts identity information from the event's authorizer context
 * @param event - Raw API Gateway event
 * @returns Identity context or undefined if not authenticated
 */
export function extractIdentity(event: any): IdentityContext | undefined {
  const authorizer = event?.requestContext?.authorizer;
  const claims = extractClaims(authorizer);
  
  if (!claims) {
    return undefined;
  }
  
  return {
    userId: claims.sub || claims['cognito:username'] || claims.userId || claims.user_id,
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
