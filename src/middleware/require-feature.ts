import type { NormalizedEvent, MiddlewareFn } from '../types/routes.js';
import { forbiddenResponse } from '../http/response.js';
import { hasAnyGroup } from '../identity/extractor.js';

/**
 * Groups that bypass the feature check.
 * PLATFORM_ADMIN = MLHolding employees in the Backoffice pool.
 */
const FEATURE_BYPASS_ROLES = ['PLATFORM_ADMIN'];

/**
 * Parses the `features` JWT claim into a string[] of feature CODES.
 * The claim can arrive as a comma-separated string (Cognito) or an array,
 * mirroring how parseGroups handles cognito:groups.
 */
function parseFeatures(features: string | string[] | undefined): string[] {
  if (!features) return [];
  if (Array.isArray(features)) return features;
  return features.split(',').map(f => f.trim()).filter(Boolean);
}

/**
 * Factory that builds a route-level premium-feature guard.
 *
 * Reads the `features` claim (a CSV of feature CODES) from
 * event.context.identity.claims.features, minted by ml-auth's
 * PreTokenGeneration. The claim holds the premium feature codes the tenant's
 * plan TIER unlocks (tenant-wide). Passes when the identity holds AT LEAST ONE
 * of the required codes. PLATFORM_ADMIN always bypasses.
 *
 * The features model is DEFAULT-OPEN: only premium endpoints attach this guard;
 * unrestricted (free) endpoints attach nothing. So a feature that is not gated
 * never reaches this middleware.
 *
 * Attach ONLY on private/backoffice routes — NEVER on internal routes
 * (those are Lambda-to-Lambda IAM-authed and carry no JWT features claim).
 *
 * Throws forbiddenResponse (403, code FEATURE_NOT_IN_PLAN) on a miss; the
 * dispatcher catches the thrown HttpResponse and returns it.
 *
 * Usage:
 * ```typescript
 * private: {
 *   post: {
 *     '/properties/{id}/ai-description': {
 *       handler: generateAiDescription,
 *       middleware: [requireFeature('aiDescriptions')],
 *     },
 *   },
 * }
 * ```
 *
 * @param code - A single feature code, or an array (ANY match passes).
 */
export function requireFeature(code: string | string[]): MiddlewareFn {
  const requiredCodes = Array.isArray(code) ? code : [code];

  return async (event: NormalizedEvent): Promise<NormalizedEvent> => {
    // PLATFORM_ADMIN bypasses the feature check
    if (hasAnyGroup(event.context.identity, FEATURE_BYPASS_ROLES)) {
      return event;
    }

    const unlocked = parseFeatures(event.context.identity?.claims?.features);

    const hasAny = requiredCodes.some(required => unlocked.includes(required));
    if (!hasAny) {
      throw forbiddenResponse(
        `Missing required feature: ${requiredCodes.join(' or ')}`,
        'FEATURE_NOT_IN_PLAN' as any
      );
    }

    return event;
  };
}
