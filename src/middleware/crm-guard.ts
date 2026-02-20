import type { NormalizedEvent, MiddlewareFn } from '../types/routes.js';
import { forbiddenResponse } from '../http/response.js';
import { hasAnyGroup } from '../identity/extractor.js';

/**
 * Roles that bypass CRM plan check.
 */
const CRM_BYPASS_ROLES = ['PLATFORM_ADMIN'];

/**
 * Middleware that enforces CRM access based on the tenant's subscription plan.
 *
 * Checks event.context.tenantInfo.hasCRM (set by initTenantContext from JWT claims).
 * If the tenant doesn't have CRM access, returns 403 with upgrade message.
 *
 * IMPORTANT: This middleware MUST run AFTER tenantGuard (which ensures tenantInfo exists).
 *
 * Usage: Add as route-level or segment middleware for CRM-only endpoints.
 *
 * ```typescript
 * private: {
 *   middleware: [tenantGuard],  // ← runs first
 *   routes: {
 *     get: {
 *       '/crm/dashboard': { handler: getCRMDashboard, middleware: [crmGuard] },  // ← runs second
 *       '/crm/leads': { handler: getLeads, middleware: [crmGuard] },
 *     }
 *   }
 * }
 * ```
 */
export const crmGuard: MiddlewareFn = async (
  event: NormalizedEvent
): Promise<NormalizedEvent> => {
  // PLATFORM_ADMIN bypasses CRM check
  if (hasAnyGroup(event.context.identity, CRM_BYPASS_ROLES)) {
    return event;
  }

  const tenantInfo = event.context.tenantInfo;

  // Check hasCRM from tenantInfo (set from JWT claim custom:hasCRM)
  if (!tenantInfo?.hasCRM) {
    throw forbiddenResponse(
      'CRM access requires a paid plan. Please upgrade your subscription.',
      'CRM_ACCESS_DENIED' as any
    );
  }

  return event;
};
