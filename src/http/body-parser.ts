/**
 * Safe JSON body parsing utilities
 */

/**
 * Safely parses a JSON body string
 * @param body - Raw body string from event
 * @param isBase64Encoded - Whether the body is base64 encoded
 * @returns Parsed object or empty object on error
 */
export function parseJsonBody(body: string | null | undefined, isBase64Encoded?: boolean): Record<string, any> {
  if (!body) return {};
  
  try {
    let decodedBody = body;
    
    if (isBase64Encoded) {
      decodedBody = Buffer.from(body, 'base64').toString('utf-8');
    }
    
    const parsed = JSON.parse(decodedBody) as Record<string, any>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

/**
 * Safely parses query string parameters
 * Handles multi-value parameters
 * @param params - Query string parameters object
 * @returns Normalized parameters
 */
export function parseQueryParams(
  params: Record<string, string | undefined> | null | undefined
): Record<string, string> {
  if (!params) return {};
  
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Middleware-style body parser that can be applied to events
 */
export function withJsonBodyParser<T extends { body?: string; isBase64Encoded?: boolean }>(
  event: T
): T & { parsedBody: Record<string, any> } {
  return {
    ...event,
    parsedBody: parseJsonBody(event.body, event.isBase64Encoded),
  };
}
