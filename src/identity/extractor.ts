import { IdentityContext } from '../types/routes.js';

/**
 * Extracts identity context from API Gateway authorizer claims
 * Supports Cognito User Pools and custom authorizers
 */

/**
 * Extracts identity information from the event's authorizer context
 * @param event - Raw API Gateway event
 * @returns Identity context or undefined if not authenticated
 */
export function extractIdentity(event: any): IdentityContext | undefined {
  const claims = event?.requestContext?.authorizer?.claims;
  
  if (!claims) {
    return undefined;
  }
  
  return {
    userId: claims.sub || claims['cognito:username'],
    email: claims.email,
    groups: parseGroups(claims['cognito:groups']),
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
