import { dispatchEvent, detectEventType } from '../src/dispatcher';
import { EventType, RouteSegment } from '../src/types/event-type.enum';
import { SegmentedHttpRouter, DispatchRoutes, NormalizedEvent } from '../src/types/routes';

describe('detectEventType', () => {
  it('should detect EventBridge events', () => {
    const event = { source: 'EVENT_BRIDGE', detail: { operationName: 'test' } };
    expect(detectEventType(event)).toBe(EventType.EventBridge);
  });

  it('should detect API Gateway events', () => {
    const event = { requestContext: { requestId: '123' }, httpMethod: 'GET', path: '/test' };
    expect(detectEventType(event)).toBe(EventType.ApiGateway);
  });

  it('should detect Lambda invocation events', () => {
    const event = { awsRequestId: '1234-5678' };
    expect(detectEventType(event)).toBe(EventType.Lambda);
  });

  it('should detect SQS events', () => {
    const event = {
      Records: [
        { eventSource: 'aws:sqs', body: '{}', eventSourceARN: 'arn:aws:sqs:us-east-1:123:my-queue' }
      ]
    };
    expect(detectEventType(event)).toBe(EventType.Sqs);
  });

  it('should return Unknown for unrecognized events', () => {
    const event = { foo: 'bar' };
    expect(detectEventType(event)).toBe(EventType.Unknown);
  });
});

describe('dispatchEvent - API Gateway', () => {
  const mockHandler = jest.fn().mockResolvedValue({ statusCode: 200, body: '{}' });

  beforeEach(() => {
    mockHandler.mockClear();
  });

  it('should dispatch to flat HTTP router', async () => {
    const routes: DispatchRoutes = {
      apigateway: {
        get: {
          '/users': { handler: mockHandler }
        }
      }
    };

    const event = {
      requestContext: { requestId: '123' },
      httpMethod: 'GET',
      resource: '/users',
      path: '/users',
      headers: {},
      queryStringParameters: null,
      body: null
    };

    await dispatchEvent(event, routes);

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: EventType.ApiGateway,
        context: expect.objectContaining({
          segment: RouteSegment.Public
        })
      })
    );
  });

  it('should dispatch to segmented router', async () => {
    const routes: DispatchRoutes = {
      apigateway: {
        public: {
          get: { '/health': { handler: mockHandler } }
        },
        private: {
          get: { '/profile': { handler: mockHandler } }
        }
      } as SegmentedHttpRouter
    };

    const event = {
      requestContext: { requestId: '123' },
      httpMethod: 'GET',
      resource: '/profile',
      path: '/profile',
      headers: {},
      body: null
    };

    await dispatchEvent(event, routes);

    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          segment: RouteSegment.Private
        })
      })
    );
  });

  it('should match path parameters', async () => {
    const routes: DispatchRoutes = {
      apigateway: {
        get: {
          '/users/{id}': { handler: mockHandler }
        }
      }
    };

    const event = {
      requestContext: { requestId: '123' },
      httpMethod: 'GET',
      resource: '/users/{id}',
      path: '/users/123',
      headers: {},
      body: null
    };

    await dispatchEvent(event, routes);

    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { id: '123' }
      })
    );
  });

  it('should parse JSON body', async () => {
    const routes: DispatchRoutes = {
      apigateway: {
        post: {
          '/users': { handler: mockHandler }
        }
      }
    };

    const event = {
      requestContext: { requestId: '123' },
      httpMethod: 'POST',
      resource: '/users',
      path: '/users',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John', email: 'john@example.com' })
    };

    await dispatchEvent(event, routes);

    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          body: { name: 'John', email: 'john@example.com' }
        })
      })
    );
  });

  it('should return 404 when route not found', async () => {
    const routes: DispatchRoutes = {
      apigateway: {
        get: {
          '/users': { handler: mockHandler }
        }
      }
    };

    const event = {
      requestContext: { requestId: '123' },
      httpMethod: 'GET',
      resource: '/nonexistent',
      path: '/nonexistent',
      headers: {},
      body: null
    };

    const result = await dispatchEvent(event, routes);

    expect(result.statusCode).toBe(404);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should execute global middleware', async () => {
    const middlewareFn = jest.fn().mockImplementation((event: NormalizedEvent) => {
      return { ...event, payload: { ...event.payload, modified: true } };
    });

    const routes: DispatchRoutes = {
      apigateway: {
        get: { '/test': { handler: mockHandler } }
      }
    };

    const event = {
      requestContext: { requestId: '123' },
      httpMethod: 'GET',
      resource: '/test',
      path: '/test',
      headers: {},
      body: null
    };

    await dispatchEvent(event, routes, {
      globalMiddleware: [middlewareFn]
    });

    expect(middlewareFn).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });
});

describe('dispatchEvent - EventBridge', () => {
  const mockHandler = jest.fn().mockResolvedValue({ success: true });

  beforeEach(() => {
    mockHandler.mockClear();
  });

  it('should dispatch to named operation handler', async () => {
    const routes: DispatchRoutes = {
      eventbridge: {
        'user.created': mockHandler
      }
    };

    const event = {
      source: 'EVENT_BRIDGE',
      detail: { operationName: 'user.created', userId: '123' }
    };

    await dispatchEvent(event, routes);

    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('should fallback to default handler', async () => {
    const routes: DispatchRoutes = {
      eventbridge: {
        default: mockHandler
      }
    };

    const event = {
      source: 'EVENT_BRIDGE',
      detail: { operationName: 'unknown.event' }
    };

    await dispatchEvent(event, routes);

    expect(mockHandler).toHaveBeenCalledTimes(1);
  });
});

describe('dispatchEvent - SQS', () => {
  const mockHandler = jest.fn().mockResolvedValue({ success: true });

  beforeEach(() => {
    mockHandler.mockClear();
  });

  it('should dispatch to queue handler', async () => {
    const routes: DispatchRoutes = {
      sqs: {
        'my-queue': mockHandler
      }
    };

    const event = {
      Records: [
        {
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789:my-queue',
          body: JSON.stringify({ message: 'Hello' }),
          messageId: 'msg-123'
        }
      ]
    };

    await dispatchEvent(event, routes);

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          body: { message: 'Hello' }
        })
      })
    );
  });
});

describe('dispatchEvent - Lambda', () => {
  const mockHandler = jest.fn().mockResolvedValue({ result: 'ok' });

  beforeEach(() => {
    mockHandler.mockClear();
  });

  it('should dispatch to default Lambda handler', async () => {
    const routes: DispatchRoutes = {
      lambda: {
        default: mockHandler
      }
    };

    const event = {
      awsRequestId: '1234-5678',
      customData: { foo: 'bar' }
    };

    await dispatchEvent(event, routes);

    expect(mockHandler).toHaveBeenCalledTimes(1);
  });
});

describe('dispatchEvent - User Pool Validation', () => {
  const mockHandler = jest.fn().mockResolvedValue({ statusCode: 200 });

  beforeEach(() => {
    mockHandler.mockClear();
  });

  it('should allow public routes without token', async () => {
    const routes: DispatchRoutes = {
      apigateway: {
        public: {
          get: { '/health': { handler: mockHandler } }
        }
      } as SegmentedHttpRouter
    };

    const event = {
      requestContext: { requestId: '123' },
      httpMethod: 'GET',
      resource: '/health',
      path: '/health',
      headers: {},
      body: null
    };

    await dispatchEvent(event, routes, {
      userPools: {
        private: 'us-east-1_ABC123'
      }
    });

    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('should reject private routes with wrong User Pool', async () => {
    const routes: DispatchRoutes = {
      apigateway: {
        private: {
          get: { '/profile': { handler: mockHandler } }
        }
      } as SegmentedHttpRouter
    };

    const event = {
      requestContext: {
        requestId: '123',
        authorizer: {
          claims: {
            sub: 'user-123',
            iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_WRONG'
          }
        }
      },
      httpMethod: 'GET',
      resource: '/profile',
      path: '/profile',
      headers: {},
      body: null
    };

    const result = await dispatchEvent(event, routes, {
      userPools: {
        private: 'us-east-1_ABC123'
      }
    });

    expect(result.statusCode).toBe(403);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should allow private routes with correct User Pool', async () => {
    const routes: DispatchRoutes = {
      apigateway: {
        private: {
          get: { '/profile': { handler: mockHandler } }
        }
      } as SegmentedHttpRouter
    };

    const event = {
      requestContext: {
        requestId: '123',
        authorizer: {
          claims: {
            sub: 'user-123',
            iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123'
          }
        }
      },
      httpMethod: 'GET',
      resource: '/profile',
      path: '/profile',
      headers: {},
      body: null
    };

    await dispatchEvent(event, routes, {
      userPools: {
        private: 'us-east-1_ABC123'
      }
    });

    expect(mockHandler).toHaveBeenCalledTimes(1);
  });
});
