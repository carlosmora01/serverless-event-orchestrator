import type { NormalizedEvent, MiddlewareFn } from '../types/routes.js';
import { forbiddenResponse } from '../http/response.js';
import { hasAnyGroup } from '../identity/extractor.js';

/**
 * Roles that can operate cross-tenant (bypass tenant check).
 * PLATFORM_ADMIN = MLHolding employees in the Backoffice pool.
 */
const CROSS_TENANT_ROLES = ['PLATFORM_ADMIN'];

/**
 * Middleware that enforces tenant context on protected routes.
 * FAIL-CLOSED: If no tenant context exists and user is not PLATFORM_ADMIN, request is denied.
 *
 * Usage: Add as segment middleware for private and backoffice segments.
 *
 * ```typescript
 * const routes: AdvancedSegmentedRouter = {
 *   public: { routes: { ... } },                    // ← NO tenantGuard
 *   private: { middleware: [tenantGuard], routes: { ... } },   // ← YES
 *   backoffice: { middleware: [tenantGuard], routes: { ... } }, // ← YES
 *   internal: { routes: { ... } },                  // ← NO (uses headers, initTenantContext handles it)
 * };
 * ```
 *
 * Throws forbiddenResponse (403) if:
 *   - No tenantInfo in context AND user is not PLATFORM_ADMIN
 *   - tenantInfo exists but tenantId is empty or whitespace-only
 *
 * Allows through if:
 *   - tenantInfo exists with valid non-empty tenantId
 *   - User is PLATFORM_ADMIN (cross-tenant access)
 */
export const tenantGuard: MiddlewareFn = async (
  event: NormalizedEvent
): Promise<NormalizedEvent> => {
  const tenantInfo = event.context.tenantInfo;
  const identity = event.context.identity;

  // PLATFORM_ADMIN can operate without tenant context (cross-tenant)
  if (hasAnyGroup(identity, CROSS_TENANT_ROLES)) {
    return event;
  }

  // Fail-closed: validate tenantInfo exists AND tenantId is not empty
  if (!tenantInfo?.tenantId || tenantInfo.tenantId.trim() === '') {
    throw forbiddenResponse(
      'Tenant context required. Ensure you are authenticated with a valid tenant.',
      'TENANT_CONTEXT_MISSING' as any
    );
  }

  return event;
};
