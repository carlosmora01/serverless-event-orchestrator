/**
 * Path matching utilities for extracting path parameters
 * Supports patterns like /users/{id} and /users/{userId}/posts/{postId}
 */

/**
 * Converts a route pattern to a regex and extracts parameter names
 * @param pattern - Route pattern like /users/{id}
 * @returns Object with regex and parameter names
 */
export function patternToRegex(pattern: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  
  // Escape special regex characters except for our parameter syntax
  let regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\{(\w+)\\\}/g, (_, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    });
  
  // Ensure exact match
  regexPattern = `^${regexPattern}$`;
  
  return {
    regex: new RegExp(regexPattern),
    paramNames,
  };
}

/**
 * Matches a path against a pattern and extracts parameters
 * @param pattern - Route pattern like /users/{id}
 * @param path - Actual path like /users/123
 * @returns Extracted parameters or null if no match
 */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const { regex, paramNames } = patternToRegex(pattern);
  const match = path.match(regex);
  
  if (!match) {
    return null;
  }
  
  const params: Record<string, string> = {};
  paramNames.forEach((name, index) => {
    params[name] = match[index + 1];
  });
  
  return params;
}

/**
 * Checks if a pattern contains path parameters
 * @param pattern - Route pattern to check
 * @returns True if pattern has parameters
 */
export function hasPathParameters(pattern: string): boolean {
  return /\{[\w]+\}/.test(pattern);
}

/**
 * Normalizes a path by removing trailing slashes and ensuring leading slash
 * @param path - Path to normalize
 * @returns Normalized path
 */
export function normalizePath(path: string): string {
  if (!path) return '/';
  
  // Ensure leading slash
  let normalized = path.startsWith('/') ? path : `/${path}`;
  
  // Remove trailing slash (except for root)
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  
  return normalized;
}
