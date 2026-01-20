/**
 * Response utilities for consistent HTTP responses
 * Agnostic to domain-specific error codes - allows injection of custom codes
 */

/**
 * Standard HTTP status codes
 */
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
}

/**
 * Standard response structure
 */
export interface StandardResponse<T = unknown, C = string> {
  status: number;
  code: C;
  data?: T;
  message?: string;
}

/**
 * Lambda HTTP response format
 */
export interface HttpResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}

/**
 * Default response codes for standard HTTP statuses
 */
export const DefaultResponseCode = {
  SUCCESS: 'SUCCESS',
  CREATED: 'CREATED',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Creates a standardized HTTP response.
 * Automatically handles data/message normalization to ensure consistent structure.
 * 
 * @param statusCode - HTTP status code
 * @param data - Response payload (will be placed in 'data' field)
 * @param code - Custom response code (Domain-specific)
 * @param message - Optional message (if provided and data is null, message content will be put into 'data' for backward compatibility if needed, but the library now prefers explicit data)
 * @param headers - Optional headers
 */
export function createStandardResponse<T, C = string>(
  statusCode: number,
  data?: T,
  code?: C,
  message?: string,
  headers?: Record<string, string>
): HttpResponse {
  const responseCode = code ?? (getDefaultCodeForStatus(statusCode) as unknown as C);
  
  // Normalización automática:
  // Si tenemos un mensaje pero no data, y el status es error, 
  // podríamos querer que el mensaje sea la descripción en data.
  // Pero lo más limpio es seguir la estructura: { status, code, data, message }
  
  const body: StandardResponse<T, C> = {
    status: statusCode,
    code: responseCode,
    ...(data !== undefined && { data }),
    ...(message && { message }),
  };

  const corsOrigin = process.env.CORS_ALLOWED_ORIGINS || '*';
  const corsHeaders = process.env.CORS_ALLOWED_HEADERS || 
    'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,appVersion,app-version,platform,geo,x-forwarded-for,x-real-ip';
  const corsMethods = process.env.CORS_ALLOWED_METHODS || 'GET,POST,PUT,PATCH,DELETE,OPTIONS';

  return {
    statusCode,
    body: JSON.stringify(body, null, 2),
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Headers': corsHeaders,
      'Access-Control-Allow-Methods': corsMethods,
      ...headers,
    },
  };
}

/**
 * Gets default response code for a status
 */
function getDefaultCodeForStatus(status: number): string {
  switch (status) {
    case HttpStatus.OK:
      return DefaultResponseCode.SUCCESS;
    case HttpStatus.CREATED:
      return DefaultResponseCode.CREATED;
    case HttpStatus.BAD_REQUEST:
      return DefaultResponseCode.BAD_REQUEST;
    case HttpStatus.UNAUTHORIZED:
      return DefaultResponseCode.UNAUTHORIZED;
    case HttpStatus.FORBIDDEN:
      return DefaultResponseCode.FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      return DefaultResponseCode.NOT_FOUND;
    case HttpStatus.CONFLICT:
      return DefaultResponseCode.CONFLICT;
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return DefaultResponseCode.VALIDATION_ERROR;
    default:
      return DefaultResponseCode.INTERNAL_ERROR;
  }
}

/**
 * Success response (200 OK)
 */
export function successResponse<T, C = string>(data?: T, code?: C, headers?: Record<string, string>): HttpResponse {
  return createStandardResponse(HttpStatus.OK, data, code, undefined, headers);
}

/**
 * Created response (201 Created)
 */
export function createdResponse<T, C = string>(data?: T, code?: C, headers?: Record<string, string>): HttpResponse {
  return createStandardResponse(HttpStatus.CREATED, data, code, undefined, headers);
}

/**
 * Bad request response (400)
 */
export function badRequestResponse<C = string>(message?: string, code?: C, headers?: Record<string, string>): HttpResponse {
  return createStandardResponse(HttpStatus.BAD_REQUEST, undefined, code, message, headers);
}

/**
 * Unauthorized response (401)
 */
export function unauthorizedResponse<C = string>(message?: string, code?: C, headers?: Record<string, string>): HttpResponse {
  return createStandardResponse(HttpStatus.UNAUTHORIZED, undefined, code, message, headers);
}

/**
 * Forbidden response (403)
 */
export function forbiddenResponse<C = string>(message?: string, code?: C, headers?: Record<string, string>): HttpResponse {
  return createStandardResponse(HttpStatus.FORBIDDEN, undefined, code, message, headers);
}

/**
 * Not found response (404)
 */
export function notFoundResponse<C = string>(message?: string, code?: C, headers?: Record<string, string>): HttpResponse {
  return createStandardResponse(HttpStatus.NOT_FOUND, undefined, code, message, headers);
}

/**
 * Conflict response (409)
 */
export function conflictResponse<C = string>(message?: string, code?: C, headers?: Record<string, string>): HttpResponse {
  return createStandardResponse(HttpStatus.CONFLICT, undefined, code, message, headers);
}

/**
 * Validation error response (422)
 */
export function validationErrorResponse<C = string>(message?: string, code?: C, headers?: Record<string, string>): HttpResponse {
  return createStandardResponse(HttpStatus.UNPROCESSABLE_ENTITY, undefined, code, message, headers);
}

/**
 * Internal server error response (500)
 */
export function internalErrorResponse<C = string>(message?: string, code?: C, headers?: Record<string, string>): HttpResponse {
  return createStandardResponse(HttpStatus.INTERNAL_SERVER_ERROR, undefined, code, message, headers);
}

/**
 * Custom error response with automatic status resolution
 * @param customCode - Your domain-specific error code
 * @param message - Error message
 * @param codeToStatusMap - Mapping of custom codes to HTTP statuses
 */
export function customErrorResponse<C extends string>(
  customCode: C,
  message?: string,
  codeToStatusMap?: Record<C, HttpStatus>,
  headers?: Record<string, string>
): HttpResponse {
  const status = codeToStatusMap?.[customCode] ?? HttpStatus.INTERNAL_SERVER_ERROR;
  return createStandardResponse(status, undefined, customCode, message, headers);
}
