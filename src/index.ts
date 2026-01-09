/**
 * serverless-event-orchestrator
 * 
 * A lightweight, type-safe event dispatcher and middleware orchestrator for AWS Lambda.
 * Designed for hexagonal architectures with support for segmented routing,
 * Cognito User Pool validation, and built-in infrastructure middlewares.
 */

// Core dispatcher
export { dispatchEvent, detectEventType, createOrchestrator } from './dispatcher.js';

// Types
export {
  EventType,
  RouteSegment,
} from './types/event-type.enum.js';

export {
  HttpMethod,
  MiddlewareFn,
  RouteConfig,
  CorsConfig,
  RateLimitConfig,
  HttpRouter,
  SegmentedHttpRouter,
  SegmentConfig,
  AdvancedSegmentedRouter,
  EventBridgeRoutes,
  LambdaRoutes,
  SqsRoutes,
  DispatchRoutes,
  IdentityContext,
  RouteMatch,
  NormalizedEvent,
  OrchestratorConfig,
} from './types/routes.js';

// HTTP utilities
export {
  HttpStatus,
  StandardResponse,
  HttpResponse,
  DefaultResponseCode,
  createStandardResponse,
  successResponse,
  createdResponse,
  badRequestResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
  validationErrorResponse,
  internalErrorResponse,
  customErrorResponse,
} from './http/response.js';

export {
  parseJsonBody,
  parseQueryParams,
  withJsonBodyParser,
} from './http/body-parser.js';

export {
  isPreflightRequest,
  createPreflightResponse,
  applyCorsHeaders,
  withCors,
} from './http/cors.js';

// Identity utilities
export {
  extractIdentity,
  extractUserPoolId,
  validateIssuer,
  hasAnyGroup,
  hasAllGroups,
} from './identity/extractor.js';

// Path utilities
export {
  matchPath,
  patternToRegex,
  hasPathParameters,
  normalizePath,
} from './utils/path-matcher.js';

// Header utilities
export {
  normalizeHeaders,
  getHeader,
  getCorsHeaders,
} from './utils/headers.js';
