import type { TenantInfo } from './types.js';
import { isTenantType, isPlan, TENANT_HEADERS } from './types.js';

/**
 * Resolves a claim value by checking both `custom:{key}` and `{key}` formats.
 * Cognito Pre Token Generation V2 adds claims WITHOUT the `custom:` prefix,
 * while Cognito user pool custom attributes use the `custom:` prefix.
 * This helper supports both conventions transparently.
 */
function getClaim(claims: Record<string, any>, key: string): any {
  return claims[`custom:${key}`] ?? claims[key];
}

/**
 * Builds a TenantInfo from TenantClaims in the JWT.
 * Used by initTenantContext middleware in serverless-event-orchestrator.
 *
 * Supports claims with or without the `custom:` prefix:
 * - `custom:tenantId` (Cognito user pool custom attributes)
 * - `tenantId` (Cognito Pre Token Generation V2 added claims)
 *
 * @param claims - Partial claims object from JWT (event.context.identity.claims)
 * @returns TenantInfo if all required fields are present, undefined otherwise
 */
export function tenantInfoFromClaims(claims: Record<string, any>): TenantInfo | undefined {
  const tenantId = getClaim(claims, 'tenantId');
  const tenantType = getClaim(claims, 'tenantType');
  const userId = getClaim(claims, 'userId') || claims['sub'];
  const countryCode = getClaim(claims, 'countryCode');
  const personProfileId = getClaim(claims, 'personProfileId');
  const orgProfileId = getClaim(claims, 'orgProfileId');
  const hasCRM = getClaim(claims, 'hasCRM');

  if (!tenantId || !tenantType || !userId || !countryCode) {
    return undefined;
  }

  if (!isTenantType(tenantType)) {
    return undefined;
  }

  return {
    tenantId,
    tenantType,
    userId,
    personProfileId,
    orgProfileId,
    countryCode,
    plan: isPlan(getClaim(claims, 'plan')) ? getClaim(claims, 'plan') : undefined,
    hasCRM,
  };
}

/**
 * Builds a TenantInfo from headers (Lambda-to-Lambda).
 * Used by initTenantContext middleware for internal routes.
 *
 * @param headers - Headers object (may have original or lowercase keys)
 * @returns TenantInfo if all required fields are present, undefined otherwise
 */
export function tenantInfoFromHeaders(
  headers: Record<string, string | undefined>
): TenantInfo | undefined {
  const get = (key: string) => headers[key] || headers[key.toLowerCase()];

  const tenantId = get(TENANT_HEADERS.TENANT_ID);
  const tenantType = get(TENANT_HEADERS.TENANT_TYPE);
  const userId = get(TENANT_HEADERS.USER_ID);
  const countryCode = get(TENANT_HEADERS.COUNTRY_CODE);

  if (!tenantId || !tenantType || !userId || !countryCode) {
    return undefined;
  }

  if (!isTenantType(tenantType)) {
    return undefined;
  }

  return {
    tenantId,
    tenantType: tenantType as 'ORG' | 'PERSON',
    userId,
    personProfileId: get(TENANT_HEADERS.PERSON_PROFILE_ID),
    orgProfileId: get(TENANT_HEADERS.ORG_PROFILE_ID),
    countryCode,
  };
}

/**
 * Converts TenantInfo to headers for Lambda-to-Lambda propagation.
 * Used by ApiInvoker to propagate the context.
 *
 * @param tenant - TenantInfo to serialize
 * @returns Headers object with X-Tenant-* headers
 */
export function tenantInfoToHeaders(tenant: TenantInfo): Record<string, string> {
  const headers: Record<string, string> = {
    [TENANT_HEADERS.TENANT_ID]: tenant.tenantId,
    [TENANT_HEADERS.TENANT_TYPE]: tenant.tenantType,
    [TENANT_HEADERS.USER_ID]: tenant.userId,
    [TENANT_HEADERS.COUNTRY_CODE]: tenant.countryCode,
  };

  if (tenant.personProfileId) {
    headers[TENANT_HEADERS.PERSON_PROFILE_ID] = tenant.personProfileId;
  }
  if (tenant.orgProfileId) {
    headers[TENANT_HEADERS.ORG_PROFILE_ID] = tenant.orgProfileId;
  }

  return headers;
}
