import {
  isPreflightRequest,
  createPreflightResponse,
  applyCorsHeaders,
  withCors
} from '../src/http/cors';
import { HttpResponse } from '../src/http/response';

describe('isPreflightRequest', () => {
  it('should return true for OPTIONS request', () => {
    const event = { httpMethod: 'OPTIONS' };
    expect(isPreflightRequest(event)).toBe(true);
  });

  it('should return true for lowercase options', () => {
    const event = { httpMethod: 'options' };
    expect(isPreflightRequest(event)).toBe(true);
  });

  it('should return false for GET request', () => {
    const event = { httpMethod: 'GET' };
    expect(isPreflightRequest(event)).toBe(false);
  });

  it('should return false for POST request', () => {
    const event = { httpMethod: 'POST' };
    expect(isPreflightRequest(event)).toBe(false);
  });

  it('should return false for undefined httpMethod', () => {
    const event = {};
    expect(isPreflightRequest(event)).toBe(false);
  });
});

describe('createPreflightResponse', () => {
  it('should return 204 with default CORS headers', () => {
    const response = createPreflightResponse(true);
    
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(response.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers?.['Access-Control-Allow-Methods']).toContain('GET');
  });

  it('should use custom CORS config', () => {
    const response = createPreflightResponse({
      origins: ['https://myapp.com'],
      methods: ['GET', 'POST'],
      credentials: true
    });
    
    expect(response.headers?.['Access-Control-Allow-Origin']).toBe('https://myapp.com');
    expect(response.headers?.['Access-Control-Allow-Methods']).toBe('GET, POST');
    expect(response.headers?.['Access-Control-Allow-Credentials']).toBe('true');
  });
});

describe('applyCorsHeaders', () => {
  const originalResponse: HttpResponse = {
    statusCode: 200,
    body: JSON.stringify({ data: 'test' }),
    headers: { 'Content-Type': 'application/json' }
  };

  it('should add CORS headers to response', () => {
    const response = applyCorsHeaders(originalResponse, true);
    
    expect(response.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers?.['Content-Type']).toBe('application/json');
  });

  it('should not modify response when cors is false', () => {
    const response = applyCorsHeaders(originalResponse, false);
    
    expect(response.headers?.['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('should use custom CORS config', () => {
    const response = applyCorsHeaders(originalResponse, {
      origins: ['https://example.com'],
      maxAge: 3600
    });
    
    expect(response.headers?.['Access-Control-Allow-Origin']).toBe('https://example.com');
    expect(response.headers?.['Access-Control-Max-Age']).toBe('3600');
  });
});

describe('withCors', () => {
  const mockHandler = jest.fn().mockResolvedValue({
    statusCode: 200,
    body: JSON.stringify({ success: true })
  });

  beforeEach(() => {
    mockHandler.mockClear();
  });

  it('should handle preflight requests without calling handler', async () => {
    const wrappedHandler = withCors(mockHandler, true);
    
    const event = { eventRaw: { httpMethod: 'OPTIONS' } };
    const response = await wrappedHandler(event);
    
    expect(response.statusCode).toBe(204);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should call handler and add CORS headers for non-preflight', async () => {
    const wrappedHandler = withCors(mockHandler, true);
    
    const event = { eventRaw: { httpMethod: 'GET' } };
    const response = await wrappedHandler(event);
    
    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(response.headers?.['Access-Control-Allow-Origin']).toBe('*');
  });

  it('should work with custom CORS config', async () => {
    const wrappedHandler = withCors(mockHandler, {
      origins: ['https://myapp.com'],
      credentials: true
    });
    
    const event = { eventRaw: { httpMethod: 'POST' } };
    const response = await wrappedHandler(event);
    
    expect(response.headers?.['Access-Control-Allow-Origin']).toBe('https://myapp.com');
    expect(response.headers?.['Access-Control-Allow-Credentials']).toBe('true');
  });
});
