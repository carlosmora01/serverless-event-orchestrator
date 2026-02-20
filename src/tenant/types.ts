/**
 * Tenant types for the multi-tenant system.
 * - ORG: Organization/Agency (tenantId = orgProfileId)
 * - PERSON: Independent agent (tenantId = personProfileId)
 */
export type TenantType = 'ORG' | 'PERSON';

/**
 * SaaS subscription plans.
 * Determine the features available for a tenant.
 * Stored in the Tenants table and injected into JWT via Pre Token Generation.
 */
export type Plan = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';

/**
 * Features enabled per plan.
 * Stored in the Tenants table and queried from JWT claim or table directly.
 */
export interface TenantFeatures {
  maxProperties: number;
  hasWhiteLabelWebsite: boolean;
  hasCRMAccess: boolean;
  hasAdvancedAnalytics: boolean;
  maxAgents: number;
}

/**
 * Tenant information that travels in the context of each request.
 * Propagated via AsyncLocalStorage and available throughout the async chain.
 *
 * Filled from JWT claims (private/backoffice routes) or from headers
 * X-Tenant-Id (internal routes, Lambda-to-Lambda).
 */
export interface TenantInfo {
  /** Tenant ID: orgProfileId (ORG) or personProfileId (PERSON) */
  tenantId: string;

  /** Tenant type */
  tenantType: TenantType;

  /** Authenticated user ID (Cognito sub or custom:userId) */
  userId: string;

  /** PersonProfileId of the user (always present, it's their personal profile) */
  personProfileId?: string;

  /** OrgProfileId if belongs to an organization (only for TenantType = ORG) */
  orgProfileId?: string;

  /** User's country code (ISO 3166-1 alpha-2, e.g., 'CO', 'MX', 'US') */
  countryCode: string;

  /** Tenant's plan (optional, filled if present in JWT) */
  plan?: Plan;

  /** Whether the tenant has CRM access (shortcut for features.hasCRMAccess) */
  hasCRM?: boolean;
}

/**
 * Custom claims injected into the Cognito JWT via Pre Token Generation.
 * These claims are available in event.context.identity.claims
 * after the orchestrator extracts the identity.
 */
export interface TenantClaims {
  'custom:tenantId': string;
  'custom:tenantType': TenantType;
  'custom:userId': string;
  'custom:personProfileId': string;
  'custom:orgProfileId'?: string;
  'custom:countryCode': string;
  'custom:plan'?: Plan;
  'custom:hasCRM'?: string;       // 'true' | 'false' (Cognito only accepts strings)
  'custom:hasWhiteLabel'?: string; // 'true' | 'false'
}

/**
 * Headers used to propagate tenant in Lambda-to-Lambda calls.
 */
export const TENANT_HEADERS = {
  TENANT_ID: 'x-tenant-id',
  TENANT_TYPE: 'x-tenant-type',
  USER_ID: 'x-user-id',
  COUNTRY_CODE: 'x-country-code',
  PERSON_PROFILE_ID: 'x-person-profile-id',
  ORG_PROFILE_ID: 'x-org-profile-id',
} as const;

/**
 * Type guard: checks if a value is a valid TenantType.
 */
export function isTenantType(value: unknown): value is TenantType {
  return value === 'ORG' || value === 'PERSON';
}

/**
 * Type guard: checks if a value is a valid Plan.
 */
export function isPlan(value: unknown): value is Plan {
  return value === 'FREE' || value === 'BASIC' || value === 'PRO' || value === 'ENTERPRISE';
}
