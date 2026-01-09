/**
 * Header normalization utilities
 * HTTP headers are case-insensitive, this ensures consistent access
 */

/**
 * Normalizes headers to lowercase keys for consistent access
 * @param headers - Original headers object
 * @returns Headers with lowercase keys
 */
export function normalizeHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  if (!headers) return {};
  
  const normalized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }
  
  return normalized;
}

/**
 * Gets a header value case-insensitively
 * @param headers - Headers object
 * @param name - Header name to find
 * @returns Header value or undefined
 */
export function getHeader(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  
  const normalizedName = name.toLowerCase();
  
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === normalizedName) {
      return value;
    }
  }
  
  return undefined;
}

/**
 * Standard CORS headers for preflight responses
 */
export function getCorsHeaders(config?: {
  origins?: string[] | '*';
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
}): Record<string, string> {
  const origin = config?.origins === '*' ? '*' : (config?.origins?.join(', ') || '*');
  const methods = config?.methods?.join(', ') || 'GET,POST,PUT,DELETE,PATCH,OPTIONS';
  const headers = config?.headers?.join(', ') || 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token';
  
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': headers,
  };
  
  if (config?.credentials) {
    corsHeaders['Access-Control-Allow-Credentials'] = 'true';
  }
  
  if (config?.maxAge) {
    corsHeaders['Access-Control-Max-Age'] = String(config.maxAge);
  }
  
  return corsHeaders;
}
