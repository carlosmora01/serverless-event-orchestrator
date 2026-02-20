import { RouteSegment } from './event-type.enum.js';
import type { TenantInfo } from '../tenant/types.js';

/**
 * HTTP methods supported by the router
 */
export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options';

/**
 * Middleware function signature
 * Returns the modified event or throws an error to halt execution
 */
export type MiddlewareFn = (event: NormalizedEvent) => Promise<NormalizedEvent | void>;

/**
 * Route configuration for a single endpoint
 */
export interface RouteConfig {
  handler: (event: NormalizedEvent) => Promise<any>;
  middleware?: MiddlewareFn[];
  cors?: boolean | CorsConfig;
  rateLimit?: RateLimitConfig;
}

/**
 * CORS configuration options
 */
export interface CorsConfig {
  origins: string[] | '*';
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
  exposedHeaders?: string[];
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  burstLimit: number;
  rateLimit: number;
}

/**
 * Standard HTTP router structure
 * Maps HTTP methods to path-handler pairs
 */
export type HttpRouter = {
  [K in HttpMethod]?: {
    [path: string]: RouteConfig;
  };
};

/**
 * Segmented HTTP router for access control categorization
 * Allows organizing routes by security context
 */
export interface SegmentedHttpRouter {
  public?: HttpRouter;
  private?: HttpRouter;
  backoffice?: HttpRouter;
  internal?: HttpRouter;
}

/**
 * Segment configuration with optional middleware
 */
export interface SegmentConfig {
  routes: HttpRouter;
  middleware?: MiddlewareFn[];
}

/**
 * Advanced segmented router with per-segment middleware
 */
export interface AdvancedSegmentedRouter {
  public?: SegmentConfig | HttpRouter;
  private?: SegmentConfig | HttpRouter;
  backoffice?: SegmentConfig | HttpRouter;
  internal?: SegmentConfig | HttpRouter;
}

/**
 * EventBridge routes configuration
 * Maps operation names to handlers
 */
export type EventBridgeRoutes = Record<string, (event: NormalizedEvent) => Promise<any>>;

/**
 * Lambda invocation routes
 */
export type LambdaRoutes = Record<string, (event: NormalizedEvent) => Promise<any>>;

/**
 * SQS queue routes
 * Maps queue names to handlers
 */
export type SqsRoutes = Record<string, (event: NormalizedEvent) => Promise<any>>;

/**
 * Complete dispatch routes configuration
 */
export interface DispatchRoutes {
  apigateway?: HttpRouter | SegmentedHttpRouter | AdvancedSegmentedRouter;
  eventbridge?: EventBridgeRoutes;
  lambda?: LambdaRoutes;
  sqs?: SqsRoutes;
}

/**
 * Identity context extracted from the event
 */
export interface IdentityContext {
  userId?: string;
  email?: string;
  groups?: string[];
  issuer?: string;
  claims?: Record<string, any>;
}

/**
 * Route match result with extracted parameters
 */
export interface RouteMatch {
  handler: (event: NormalizedEvent) => Promise<any>;
  params: Record<string, string>;
  segment: RouteSegment;
  middleware?: MiddlewareFn[];
  config: RouteConfig;
}

/**
 * Normalized event structure passed to handlers
 */
export interface NormalizedEvent {
  eventRaw: any;
  eventType: string;
  payload: {
    body?: Record<string, any>;
    pathParameters?: Record<string, string>;
    queryStringParameters?: Record<string, string>;
    headers?: Record<string, string>;
  };
  params: Record<string, string>;
  context: {
    segment: RouteSegment;
    identity?: IdentityContext;
    requestId?: string;
    tenantInfo?: TenantInfo;
  };
}

/**
 * Orchestrator configuration options
 */
export interface OrchestratorConfig {
  /**
   * Enable verbose logging for debugging
   */
  debug?: boolean;

  /**
   * User Pool ID mappings for segment-based validation
   */
  userPools?: {
    [K in RouteSegment]?: string;
  };

  /**
   * Global middleware applied to all routes
   */
  globalMiddleware?: MiddlewareFn[];

  /**
   * Custom response handlers
   */
  responses?: {
    notFound?: () => any;
    forbidden?: () => any;
    badRequest?: (message?: string) => any;
    internalError?: (message?: string) => any;
  };

  /**
   * Automatically extract identity from Authorization header if no authorizer is present
   */
  autoExtractIdentity?: boolean;
}
