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
 * Creates a standardized HTTP response
 * @param statusCode - HTTP status code
 * @param data - Response payload
 * @param code - Custom response code
 * @param message - Optional message
 * @param headers - Optional headers
 */
export function createStandardResponse<T, C = string>(
  statusCode: number,
  data?: T,
  code?: C,
  message?: string,
  headers?: Record<string, string>
): HttpResponse {
  const responseCode = code ?? getDefaultCodeForStatus(statusCode);
  
  const body: StandardResponse<T, C | string> = {
    status: statusCode,
    code: responseCode,
    ...(data !== undefined && { data }),
    ...(message && { message }),
  };

  return {
    statusCode,
    body: JSON.stringify(body, null, 2),
    headers: {
      'Content-Type': 'application/json',
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
export function successResponse<T>(data?: T, code?: string, headers?: Record<string, string>): HttpResponse {
  return createStandardResponse(HttpStatus.OK, data, code ?? DefaultResponseCode.SUCCESS, undefined, headers);
}

/**
 * Created response (201 Created)
 */
export function createdResponse<T>(data?: T, code?: string, headers?: Record<string, string>): HttpResponse {
  return createStandardResponse(HttpStatus.CREATED, data, code ?? DefaultResponseCode.CREATED, undefined, headers);
}

/**
 * Bad request response (400)
 */
export function badRequestResponse(message?: string, code?: string, headers?: Record<string, string>): HttpResponse {
  return createStandardResponse(HttpStatus.BAD_REQUEST, undefined, code ?? DefaultResponseCode.BAD_REQUEST, message, headers);
}

/**
 * Unauthorized response (401)
 */
export function unauthorizedResponse(message?: string, code?: string, headers?: Record<string, string>): HttpResponse {
  return createStandardResponse(HttpStatus.UNAUTHORIZED, undefined, code ?? DefaultResponseCode.UNAUTHORIZED, message, headers);
}

/**
 * Forbidden response (403)
 */
export function forbiddenResponse(message?: string, code?: string, headers?: Record<string, string>): HttpResponse {
  return createStandardResponse(HttpStatus.FORBIDDEN, undefined, code ?? DefaultResponseCode.FORBIDDEN, message, headers);
}

/**
 * Not found response (404)
 */
export function notFoundResponse(message?: string, code?: string, headers?: Record<string, string>): HttpResponse {
  return createStandardResponse(HttpStatus.NOT_FOUND, undefined, code ?? DefaultResponseCode.NOT_FOUND, message, headers);
}

/**
 * Conflict response (409)
 */
export function conflictResponse(message?: string, code?: string, headers?: Record<string, string>): HttpResponse {
  return createStandardResponse(HttpStatus.CONFLICT, undefined, code ?? DefaultResponseCode.CONFLICT, message, headers);
}

/**
 * Validation error response (422)
 */
export function validationErrorResponse(message?: string, code?: string, headers?: Record<string, string>): HttpResponse {
  return createStandardResponse(HttpStatus.UNPROCESSABLE_ENTITY, undefined, code ?? DefaultResponseCode.VALIDATION_ERROR, message, headers);
}

/**
 * Internal server error response (500)
 */
export function internalErrorResponse(message?: string, code?: string, headers?: Record<string, string>): HttpResponse {
  return createStandardResponse(HttpStatus.INTERNAL_SERVER_ERROR, undefined, code ?? DefaultResponseCode.INTERNAL_ERROR, message, headers);
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
