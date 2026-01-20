import { EventType, RouteSegment } from './types/event-type.enum.js';
import {
  DispatchRoutes,
  HttpMethod,
  HttpRouter,
  SegmentedHttpRouter,
  AdvancedSegmentedRouter,
  SegmentConfig,
  RouteConfig,
  RouteMatch,
  NormalizedEvent,
  OrchestratorConfig,
  MiddlewareFn,
} from './types/routes.js';
import { matchPath, normalizePath } from './utils/path-matcher.js';
import { normalizeHeaders } from './utils/headers.js';
import { parseJsonBody, parseQueryParams } from './http/body-parser.js';
import { extractIdentity, validateIssuer } from './identity/extractor.js';
import { forbiddenResponse, badRequestResponse, notFoundResponse } from './http/response.js';

/**
 * Detects the type of AWS event
 */
export function detectEventType(event: any): EventType {
  if (event.source === 'EVENT_BRIDGE') return EventType.EventBridge;
  if (event.requestContext && event.httpMethod) return EventType.ApiGateway;
  if (event.Records && Array.isArray(event.Records) && event.Records[0]?.eventSource === 'aws:sqs') return EventType.Sqs;
  if (event.awsRequestId) return EventType.Lambda;
  return EventType.Unknown;
}

/**
 * Checks if a router is segmented (has public/private/backoffice/internal keys)
 */
function isSegmentedRouter(router: any): router is SegmentedHttpRouter | AdvancedSegmentedRouter {
  if (!router || typeof router !== 'object') return false;
  const segmentKeys = ['public', 'private', 'backoffice', 'internal'];
  const routerKeys = Object.keys(router);
  return routerKeys.some(key => segmentKeys.includes(key));
}

/**
 * Checks if a segment config has middleware
 */
function isSegmentConfig(config: any): config is SegmentConfig {
  return config && typeof config === 'object' && 'routes' in config;
}

/**
 * Gets the HttpRouter from a segment (handles both simple and advanced config)
 */
function getRouterFromSegment(segment: HttpRouter | SegmentConfig | undefined): HttpRouter | undefined {
  if (!segment) return undefined;
  if (isSegmentConfig(segment)) return segment.routes;
  return segment;
}

/**
 * Gets middleware from a segment config
 */
function getMiddlewareFromSegment(segment: HttpRouter | SegmentConfig | undefined): MiddlewareFn[] {
  if (!segment) return [];
  if (isSegmentConfig(segment)) return segment.middleware ?? [];
  return [];
}


/**
 * Finds a matching route using pattern for lookup and actualPath for params extraction
 */
function findRouteInRouterWithActualPath(
  router: HttpRouter | undefined,
  method: HttpMethod,
  routePattern: string,
  actualPath: string
): { config: RouteConfig; params: Record<string, string> } | null {
  if (!router) return null;
  
  const methodRoutes = router[method];
  if (!methodRoutes) return null;
  
  const normalizedPattern = normalizePath(routePattern);
  const normalizedActualPath = normalizePath(actualPath);
  
  // First, try exact match with the pattern
  if (methodRoutes[normalizedPattern]) {
    // Extract params from the actual path using the pattern
    const params = matchPath(normalizedPattern, normalizedActualPath) ?? {};
    return { config: methodRoutes[normalizedPattern], params };
  }
  
  // Then, try pattern matching
  for (const [pattern, config] of Object.entries(methodRoutes)) {
    const params = matchPath(pattern, normalizedActualPath);
    if (params !== null) {
      return { config, params };
    }
  }
  
  return null;
}

/**
 * Finds a route across all segments with actual path for params
 */
function findRouteInSegmentsWithActualPath(
  router: SegmentedHttpRouter | AdvancedSegmentedRouter,
  method: HttpMethod,
  routePattern: string,
  actualPath: string
): RouteMatch | null {
  const segments: RouteSegment[] = [
    RouteSegment.Public,
    RouteSegment.Private,
    RouteSegment.Backoffice,
    RouteSegment.Internal,
  ];
  
  for (const segment of segments) {
    const segmentRouter = router[segment];
    const httpRouter = getRouterFromSegment(segmentRouter);
    const result = findRouteInRouterWithActualPath(httpRouter, method, routePattern, actualPath);
    
    if (result) {
      return {
        handler: result.config.handler,
        params: result.params,
        segment,
        middleware: getMiddlewareFromSegment(segmentRouter),
        config: result.config,
      };
    }
  }
  
  return null;
}


/**
 * Normalizes an API Gateway event into a standard format
 */
function normalizeApiGatewayEvent(
  event: any,
  segment: RouteSegment,
  extractedParams: Record<string, string>,
  autoExtract: boolean = false
): NormalizedEvent {
  const identity = extractIdentity(event, autoExtract);
  
  // Merge: pathParameters from original event + extracted params (extractedParams takes priority)
  const params = { ...event.pathParameters, ...extractedParams };
  
  return {
    eventRaw: event,
    eventType: EventType.ApiGateway,
    payload: {
      body: parseJsonBody(event.body, event.isBase64Encoded),
      pathParameters: params,
      queryStringParameters: parseQueryParams(event.queryStringParameters),
      headers: normalizeHeaders(event.headers),
    },
    params,
    context: {
      segment,
      identity,
      requestId: event.requestContext?.requestId,
    },
  };
}

/**
 * Normalizes an EventBridge event
 */
function normalizeEventBridgeEvent(event: any): NormalizedEvent {
  return {
    eventRaw: event,
    eventType: EventType.EventBridge,
    payload: {
      body: event.detail,
    },
    params: {},
    context: {
      segment: RouteSegment.Internal,
      requestId: event.id,
    },
  };
}

/**
 * Normalizes an SQS event
 */
function normalizeSqsEvent(event: any): NormalizedEvent {
  const record = event.Records[0];
  let body: Record<string, any> = {};
  
  try {
    body = JSON.parse(record.body) as Record<string, any>;
  } catch {
    body = { rawBody: record.body };
  }
  
  return {
    eventRaw: event,
    eventType: EventType.Sqs,
    payload: {
      body,
    },
    params: {},
    context: {
      segment: RouteSegment.Internal,
      requestId: record.messageId,
    },
  };
}

/**
 * Normalizes a Lambda invocation event
 */
function normalizeLambdaEvent(event: any): NormalizedEvent {
  return {
    eventRaw: event,
    eventType: EventType.Lambda,
    payload: {
      body: event,
    },
    params: {},
    context: {
      segment: RouteSegment.Internal,
    },
  };
}

/**
 * Validates User Pool for a segment
 */
function validateSegmentUserPool(
  normalized: NormalizedEvent,
  segment: RouteSegment,
  config: OrchestratorConfig
): boolean {
  // Public routes don't require validation
  if (segment === RouteSegment.Public) return true;
  
  // If no user pool config, skip validation
  const expectedUserPoolId = config.userPools?.[segment];
  if (!expectedUserPoolId) return true;
  
  // Validate issuer matches expected user pool
  return validateIssuer(normalized.context.identity, expectedUserPoolId);
}

/**
 * Executes middleware chain
 */
async function executeMiddleware(
  middleware: MiddlewareFn[],
  event: NormalizedEvent
): Promise<NormalizedEvent> {
  let currentEvent = event;
  
  for (const mw of middleware) {
    const result = await mw(currentEvent);
    if (result) {
      currentEvent = result;
    }
  }
  
  return currentEvent;
}

/**
 * Applies CORS headers to any API Gateway response
 * This ensures CORS works regardless of how the handler builds its response
 */
function applyCorsToResponse(response: any): any {
  if (!response || typeof response !== 'object') return response;
  
  const corsOrigin = process.env.CORS_ALLOWED_ORIGINS || '*';
  const corsHeaders = process.env.CORS_ALLOWED_HEADERS || 
    'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,appVersion,app-version,platform,geo,x-forwarded-for,x-real-ip';
  const corsMethods = process.env.CORS_ALLOWED_METHODS || 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
  
  const existingHeaders = response.headers || {};
  
  return {
    ...response,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Headers': corsHeaders,
      'Access-Control-Allow-Methods': corsMethods,
      ...existingHeaders,
    },
  };
}

/**
 * Main dispatch function with all improvements
 */
export async function dispatchEvent(
  event: any,
  routes: DispatchRoutes,
  config: OrchestratorConfig = {}
): Promise<any> {
  const debug = config.debug ?? false;
  
  if (debug) {
    console.log('[SEO] Event received:', JSON.stringify(event, null, 2));
  }
  
  const type = detectEventType(event);
  
  if (debug) {
    console.log('[SEO] Event type:', type);
  }
  
  // Handle API Gateway events
  if (type === EventType.ApiGateway) {
    const method = event.httpMethod?.toLowerCase() as HttpMethod;
    const routePattern = event.resource || event.path;
    const actualPath = event.path || event.resource;
    
    // Handle CORS preflight requests automatically
    if (method === 'options') {
      if (debug) {
        console.log('[SEO] Handling OPTIONS preflight request');
      }
      const corsOrigin = process.env.CORS_ALLOWED_ORIGINS || '*';
      const corsHeaders = process.env.CORS_ALLOWED_HEADERS || 
        'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,appVersion,app-version,platform,geo,x-forwarded-for,x-real-ip';
      const corsMethods = process.env.CORS_ALLOWED_METHODS || 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
      const corsMaxAge = process.env.CORS_MAX_AGE || '600';
      
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Headers': corsHeaders,
          'Access-Control-Allow-Methods': corsMethods,
          'Access-Control-Max-Age': corsMaxAge,
        },
        body: '',
      };
    }
    
    if (debug) {
      console.log('[SEO] Method:', method, 'Path:', routePattern, 'Actual:', actualPath);
    }
    
    const apiRoutes = routes.apigateway;
    if (!apiRoutes) {
      return applyCorsToResponse(config.responses?.notFound?.() ?? notFoundResponse('No API routes configured'));
    }
    
    let routeMatch: RouteMatch | null = null;
    
    // Use routePattern for finding routes, but extract params from actualPath
    if (isSegmentedRouter(apiRoutes)) {
      routeMatch = findRouteInSegmentsWithActualPath(apiRoutes, method, routePattern, actualPath);
    } else {
      // Flat router - treat as public
      const result = findRouteInRouterWithActualPath(apiRoutes as HttpRouter, method, routePattern, actualPath);
      if (result) {
        routeMatch = {
          handler: result.config.handler,
          params: result.params,
          segment: RouteSegment.Public,
          middleware: [],
          config: result.config,
        };
      }
    }
    
    if (!routeMatch) {
      if (debug) {
        console.log('[SEO] No route found for:', method, routePattern);
      }
      return applyCorsToResponse(config.responses?.notFound?.() ?? notFoundResponse(`Route not found: ${method.toUpperCase()} ${routePattern}`));
    }
    
    if (debug) {
      console.log('[SEO] Route matched:', routeMatch.segment, 'Params:', routeMatch.params);
    }
    
    // Normalize event
    let normalized = normalizeApiGatewayEvent(
      event, 
      routeMatch.segment, 
      routeMatch.params,
      config.autoExtractIdentity
    );
    
    // Validate User Pool
    if (!validateSegmentUserPool(normalized, routeMatch.segment, config)) {
      if (debug) {
        console.log('[SEO] User Pool validation failed for segment:', routeMatch.segment);
      }
      return applyCorsToResponse(config.responses?.forbidden?.() ?? forbiddenResponse('Access denied: Invalid token issuer'));
    }
    
    // Execute global middleware
    if (config.globalMiddleware?.length) {
      normalized = await executeMiddleware(config.globalMiddleware, normalized);
    }
    
    // Execute segment middleware
    if (routeMatch.middleware?.length) {
      normalized = await executeMiddleware(routeMatch.middleware, normalized);
    }
    
    // Execute handler and apply CORS headers to response
    const handlerResponse = await routeMatch.handler(normalized);
    return applyCorsToResponse(handlerResponse);
  }
  
  // Handle EventBridge events
  if (type === EventType.EventBridge) {
    const operationName = event.detail?.operationName;
    const handler = operationName
      ? routes.eventbridge?.[operationName] ?? routes.eventbridge?.default
      : routes.eventbridge?.default;
    
    if (!handler) {
      if (debug) {
        console.log('[SEO] No EventBridge handler for:', operationName);
      }
      return { statusCode: 404, body: 'EventBridge handler not found' };
    }
    
    const normalized = normalizeEventBridgeEvent(event);
    return handler(normalized);
  }
  
  // Handle SQS events
  if (type === EventType.Sqs) {
    const queueArn = event.Records[0]?.eventSourceARN;
    const queueName = queueArn?.split(':').pop();
    const handler = routes.sqs?.[queueName] ?? routes.sqs?.default;
    
    if (!handler) {
      if (debug) {
        console.log('[SEO] No SQS handler for queue:', queueName);
      }
      return { statusCode: 404, body: 'SQS handler not found' };
    }
    
    const normalized = normalizeSqsEvent(event);
    return handler(normalized);
  }
  
  // Handle Lambda invocation
  if (type === EventType.Lambda) {
    const handler = routes.lambda?.default;
    
    if (!handler) {
      return { statusCode: 404, body: 'Lambda handler not found' };
    }
    
    const normalized = normalizeLambdaEvent(event);
    return handler(normalized);
  }
  
  // Unknown event type
  if (debug) {
    console.log('[SEO] Unknown event type');
  }
  return config.responses?.badRequest?.('Unknown event type') ?? badRequestResponse('Unknown event type');
}

/**
 * Creates an orchestrator instance with pre-configured options
 */
export function createOrchestrator(config: OrchestratorConfig = {}) {
  return {
    dispatch: (event: any, routes: DispatchRoutes) => dispatchEvent(event, routes, config),
    config,
  };
}
