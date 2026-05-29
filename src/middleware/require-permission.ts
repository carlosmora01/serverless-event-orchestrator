import type { NormalizedEvent, MiddlewareFn } from '../types/routes.js';
import { forbiddenResponse } from '../http/response.js';
import { hasAnyGroup } from '../identity/extractor.js';

/**
 * Groups that bypass the permission check.
 * PLATFORM_ADMIN = MLHolding employees in the Backoffice pool.
 */
const PERMISSION_BYPASS_ROLES = ['PLATFORM_ADMIN'];

/**
 * Parses the `permissions` JWT claim into a string[] of permission CODES.
 * The claim can arrive as a comma-separated string (Cognito) or an array,
 * mirroring how parseGroups handles cognito:groups.
 */
function parsePermissions(permissions: string | string[] | undefined): string[] {
  if (!permissions) return [];
  if (Array.isArray(permissions)) return permissions;
  return permissions.split(',').map(p => p.trim()).filter(Boolean);
}

/**
 * Factory that builds a route-level authorization guard.
 *
 * Reads the `permissions` claim (a CSV of permission CODES) from
 * event.context.identity.claims.permissions, minted by ml-auth's
 * PreTokenGeneration. Passes when the identity holds AT LEAST ONE of the
 * required codes. PLATFORM_ADMIN always bypasses.
 *
 * Attach ONLY on private/backoffice routes — NEVER on internal routes
 * (those are Lambda-to-Lambda IAM-authed and carry no JWT permissions claim).
 *
 * Throws forbiddenResponse (403, code PERMISSION_DENIED) on a miss; the
 * dispatcher catches the thrown HttpResponse and returns it.
 *
 * Usage:
 * ```typescript
 * backoffice: {
 *   post: {
 *     '/backoffice/plans': {
 *       handler: createPlan,
 *       middleware: [requirePermission('MANAGE_PLANS')],
 *     },
 *   },
 * }
 * ```
 *
 * @param code - A single permission code, or an array (ANY match passes).
 */
export function requirePermission(code: string | string[]): MiddlewareFn {
  const requiredCodes = Array.isArray(code) ? code : [code];

  return async (event: NormalizedEvent): Promise<NormalizedEvent> => {
    // PLATFORM_ADMIN bypasses the permission check
    if (hasAnyGroup(event.context.identity, PERMISSION_BYPASS_ROLES)) {
      return event;
    }

    const granted = parsePermissions(event.context.identity?.claims?.permissions);

    const hasAny = requiredCodes.some(required => granted.includes(required));
    if (!hasAny) {
      throw forbiddenResponse(
        `Missing required permission: ${requiredCodes.join(' or ')}`,
        'PERMISSION_DENIED' as any
      );
    }

    return event;
  };
}
