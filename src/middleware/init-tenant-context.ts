import type { NormalizedEvent, MiddlewareFn } from '../types/routes.js';
import {
  TenantContext,
  tenantInfoFromClaims,
  tenantInfoFromHeaders,
  type TenantInfo,
} from '../tenant/index.js';

/**
 * Middleware that initializes the TenantContext from JWT claims or headers.
 *
 * Execution order: globalMiddleware (runs on ALL routes, before segment middleware).
 *
 * Resolution strategy:
 * 1. Private/Backoffice segments → extract from identity.claims (JWT)
 * 2. Internal segment → extract from headers (X-Tenant-Id, Lambda-to-Lambda)
 * 3. Public segment → try claims first (authenticated public), then headers, then skip
 *
 * If tenant info is found:
 *   - Sets TenantContext via AsyncLocalStorage (for repositories)
 *   - Adds tenantInfo to event.context (for handlers and logger)
 *
 * If tenant info is NOT found:
 *   - Does NOT throw (public routes are allowed without tenant)
 *   - tenantGuard (segment middleware) will enforce tenant requirement where needed
 */
export const initTenantContext: MiddlewareFn = async (
  event: NormalizedEvent
): Promise<NormalizedEvent> => {
  let tenantInfo: TenantInfo | undefined;

  // Strategy 1: From JWT claims (private, backoffice, or authenticated public)
  if (event.context.identity?.claims) {
    tenantInfo = tenantInfoFromClaims(event.context.identity.claims);
  }

  // Strategy 2: From headers (internal Lambda-to-Lambda, or fallback)
  if (!tenantInfo && event.payload.headers) {
    tenantInfo = tenantInfoFromHeaders(event.payload.headers);
  }

  // If we found tenant info, set it everywhere
  if (tenantInfo) {
    // 1. Set AsyncLocalStorage (for TenantAwareDynamoRepository and ApiInvoker)
    TenantContext.set(tenantInfo);

    // 2. Enrich event.context (for handlers, logger, and downstream middleware)
    return {
      ...event,
      context: {
        ...event.context,
        tenantInfo,
      },
    };
  }

  // No tenant info found — this is normal for public routes
  return event;
};
