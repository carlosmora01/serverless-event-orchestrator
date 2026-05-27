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
    } else {
      // API Gateway puede entregar el body interpretando bytes UTF-8 como
      // Latin-1 cuando el Content-Type no incluye `; charset=utf-8`,
      // produciendo mojibake (`MarÃ­a` en lugar de `María`). Si detectamos
      // el patrón típico (byte UTF-8 multibyte visto como Latin-1),
      // revertimos re-codificando latin1 → utf-8.
      decodedBody = fixUtf8Mojibake(decodedBody);
    }

    const parsed = JSON.parse(decodedBody) as Record<string, any>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

/**
 * Detecta mojibake UTF-8-as-Latin-1 y lo revierte. La heurística busca un
 * primer byte UTF-8 multibyte (0xC2-0xF4) seguido de un byte de continuación
 * (0x80-0xBF). En texto natural casi siempre indica corrupción de encoding;
 * si no hay match, el body se considera limpio y se devuelve intacto, así
 * los bodies ASCII puros o UTF-8 ya correctos no se ven afectados.
 */
function fixUtf8Mojibake(input: string): string {
  if (!MOJIBAKE_PATTERN.test(input)) return input;
  try {
    return Buffer.from(input, 'latin1').toString('utf-8');
  } catch {
    return input;
  }
}

const MOJIBAKE_PATTERN = /[Â-ô][-¿]/;

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
