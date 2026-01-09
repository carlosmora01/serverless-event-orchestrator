import { normalizeHeaders, getHeader, getCorsHeaders } from '../src/utils/headers';

describe('normalizeHeaders', () => {
  it('should convert all header keys to lowercase', () => {
    const headers = {
      'Content-Type': 'application/json',
      'X-Custom-Header': 'value',
      'AUTHORIZATION': 'Bearer token'
    };

    const normalized = normalizeHeaders(headers);

    expect(normalized['content-type']).toBe('application/json');
    expect(normalized['x-custom-header']).toBe('value');
    expect(normalized['authorization']).toBe('Bearer token');
  });

  it('should return empty object for undefined headers', () => {
    expect(normalizeHeaders(undefined)).toEqual({});
  });

  it('should return empty object for empty headers', () => {
    expect(normalizeHeaders({})).toEqual({});
  });
});

describe('getHeader', () => {
  const headers = {
    'Content-Type': 'application/json',
    'X-Request-ID': '12345'
  };

  it('should get header case-insensitively', () => {
    expect(getHeader(headers, 'content-type')).toBe('application/json');
    expect(getHeader(headers, 'Content-Type')).toBe('application/json');
    expect(getHeader(headers, 'CONTENT-TYPE')).toBe('application/json');
  });

  it('should return undefined for missing header', () => {
    expect(getHeader(headers, 'Authorization')).toBeUndefined();
  });

  it('should return undefined for undefined headers', () => {
    expect(getHeader(undefined, 'Content-Type')).toBeUndefined();
  });
});

describe('getCorsHeaders', () => {
  it('should return default CORS headers without config', () => {
    const corsHeaders = getCorsHeaders();

    expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*');
    expect(corsHeaders['Access-Control-Allow-Methods']).toContain('GET');
    expect(corsHeaders['Access-Control-Allow-Methods']).toContain('POST');
    expect(corsHeaders['Access-Control-Allow-Headers']).toContain('Content-Type');
  });

  it('should use custom origins', () => {
    const corsHeaders = getCorsHeaders({
      origins: ['https://example.com', 'https://app.example.com']
    });

    expect(corsHeaders['Access-Control-Allow-Origin']).toBe('https://example.com, https://app.example.com');
  });

  it('should use wildcard origin', () => {
    const corsHeaders = getCorsHeaders({ origins: '*' });

    expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*');
  });

  it('should set credentials header', () => {
    const corsHeaders = getCorsHeaders({ credentials: true });

    expect(corsHeaders['Access-Control-Allow-Credentials']).toBe('true');
  });

  it('should set max age header', () => {
    const corsHeaders = getCorsHeaders({ maxAge: 86400 });

    expect(corsHeaders['Access-Control-Max-Age']).toBe('86400');
  });

  it('should use custom methods', () => {
    const corsHeaders = getCorsHeaders({
      methods: ['GET', 'POST']
    });

    expect(corsHeaders['Access-Control-Allow-Methods']).toBe('GET, POST');
  });

  it('should use custom headers', () => {
    const corsHeaders = getCorsHeaders({
      headers: ['X-Custom-Header', 'X-Another-Header']
    });

    expect(corsHeaders['Access-Control-Allow-Headers']).toBe('X-Custom-Header, X-Another-Header');
  });
});
