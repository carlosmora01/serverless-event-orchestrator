import { CorsConfig } from '../types/routes.js';
import { getCorsHeaders } from '../utils/headers.js';
import { HttpResponse } from './response.js';

/**
 * CORS handling utilities
 */

/**
 * Checks if a request is a CORS preflight request
 * @param event - Raw API Gateway event
 * @returns True if this is an OPTIONS preflight request
 */
export function isPreflightRequest(event: any): boolean {
  return event.httpMethod?.toUpperCase() === 'OPTIONS';
}

/**
 * Creates a preflight response with CORS headers
 * @param config - CORS configuration
 * @returns HTTP response for preflight
 */
export function createPreflightResponse(config?: CorsConfig | boolean): HttpResponse {
  const corsConfig = config === true ? undefined : (config === false ? undefined : config);
  
  return {
    statusCode: 204,
    body: '',
    headers: getCorsHeaders(corsConfig),
  };
}

/**
 * Applies CORS headers to an existing response
 * @param response - Original response
 * @param config - CORS configuration
 * @returns Response with CORS headers
 */
export function applyCorsHeaders(response: HttpResponse, config?: CorsConfig | boolean): HttpResponse {
  if (config === false) return response;
  
  const corsConfig = config === true ? undefined : config;
  const corsHeaders = getCorsHeaders(corsConfig);
  
  return {
    ...response,
    headers: {
      ...corsHeaders,
      ...response.headers,
    },
  };
}

/**
 * Middleware that handles CORS for a handler
 * @param handler - Original handler function
 * @param config - CORS configuration
 * @returns Wrapped handler with CORS support
 */
export function withCors<T extends (...args: any[]) => Promise<HttpResponse>>(
  handler: T,
  config?: CorsConfig | boolean
): T {
  return (async (...args: Parameters<T>): Promise<HttpResponse> => {
    const event = args[0];
    
    // Handle preflight requests
    if (isPreflightRequest(event?.eventRaw ?? event)) {
      return createPreflightResponse(config);
    }
    
    // Execute handler and apply CORS headers
    const response = await handler(...args);
    return applyCorsHeaders(response, config);
  }) as T;
}
