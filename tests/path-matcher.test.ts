import { 
  matchPath, 
  patternToRegex, 
  hasPathParameters, 
  normalizePath 
} from '../src/utils/path-matcher';

describe('patternToRegex', () => {
  it('should convert simple pattern without parameters', () => {
    const { regex, paramNames } = patternToRegex('/users');
    expect(paramNames).toEqual([]);
    expect(regex.test('/users')).toBe(true);
    expect(regex.test('/users/')).toBe(false);
    expect(regex.test('/other')).toBe(false);
  });

  it('should extract single parameter name', () => {
    const { regex, paramNames } = patternToRegex('/users/{id}');
    expect(paramNames).toEqual(['id']);
    expect(regex.test('/users/123')).toBe(true);
    expect(regex.test('/users/abc-def')).toBe(true);
    expect(regex.test('/users/')).toBe(false);
  });

  it('should extract multiple parameter names', () => {
    const { regex, paramNames } = patternToRegex('/users/{userId}/posts/{postId}');
    expect(paramNames).toEqual(['userId', 'postId']);
    expect(regex.test('/users/123/posts/456')).toBe(true);
  });

  it('should escape special regex characters', () => {
    const { regex } = patternToRegex('/api/v1.0/users');
    expect(regex.test('/api/v1.0/users')).toBe(true);
    expect(regex.test('/api/v1X0/users')).toBe(false);
  });
});

describe('matchPath', () => {
  it('should return null for non-matching paths', () => {
    expect(matchPath('/users', '/posts')).toBeNull();
    expect(matchPath('/users/{id}', '/posts/123')).toBeNull();
  });

  it('should return empty params for exact match without parameters', () => {
    const result = matchPath('/users', '/users');
    expect(result).toEqual({});
  });

  it('should extract single path parameter', () => {
    const result = matchPath('/users/{id}', '/users/123');
    expect(result).toEqual({ id: '123' });
  });

  it('should extract multiple path parameters', () => {
    const result = matchPath('/users/{userId}/posts/{postId}', '/users/abc/posts/xyz');
    expect(result).toEqual({ userId: 'abc', postId: 'xyz' });
  });

  it('should handle parameters with special characters', () => {
    const result = matchPath('/users/{id}', '/users/user-123_abc');
    expect(result).toEqual({ id: 'user-123_abc' });
  });

  it('should not match partial paths', () => {
    expect(matchPath('/users/{id}', '/users/123/extra')).toBeNull();
    expect(matchPath('/users/{id}/posts', '/users/123')).toBeNull();
  });
});

describe('hasPathParameters', () => {
  it('should return true for patterns with parameters', () => {
    expect(hasPathParameters('/users/{id}')).toBe(true);
    expect(hasPathParameters('/users/{userId}/posts/{postId}')).toBe(true);
  });

  it('should return false for patterns without parameters', () => {
    expect(hasPathParameters('/users')).toBe(false);
    expect(hasPathParameters('/users/list')).toBe(false);
  });
});

describe('normalizePath', () => {
  it('should add leading slash if missing', () => {
    expect(normalizePath('users')).toBe('/users');
  });

  it('should remove trailing slash', () => {
    expect(normalizePath('/users/')).toBe('/users');
  });

  it('should keep root path as is', () => {
    expect(normalizePath('/')).toBe('/');
  });

  it('should handle empty string', () => {
    expect(normalizePath('')).toBe('/');
  });

  it('should normalize complex paths', () => {
    expect(normalizePath('users/123/')).toBe('/users/123');
  });
});
