# serverless-event-orchestrator

[![npm version](https://badge.fury.io/js/serverless-event-orchestrator.svg)](https://www.npmjs.com/package/serverless-event-orchestrator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight, type-safe event dispatcher and middleware orchestrator for AWS Lambda. Designed for hexagonal architectures with support for segmented routing (public, private, backoffice), Cognito User Pool validation, and built-in infrastructure middlewares.

## Features

- **Multi-Trigger Support**: Handle HTTP (API Gateway), SQS, EventBridge, Scheduled Events (cron/rate), and Lambda invocations with a single handler
- **Segmented Routing**: Organize routes by security context (`public`, `private`, `backoffice`, `internal`)
- **Path Parameters**: Built-in support for dynamic routes like `/users/{id}`
- **Identity Aware**: Cryptographic JWT signature verification via `aws-jwt-verify`, Cognito User Pool validation per segment
- **Middleware Support**: Global and per-segment middleware chains
- **Zero Config CORS**: Built-in CORS handling with sensible defaults
- **Response Utilities**: Standardized response helpers (success, error, etc.)
- **TypeScript First**: Full type safety with exported interfaces

## Installation

```bash
npm install serverless-event-orchestrator
```

## Quick Start

### Basic Usage (Flat Routes)

```typescript
import { dispatchEvent, HttpRouter, successResponse } from 'serverless-event-orchestrator';

const routes: HttpRouter = {
  get: {
    '/users': {
      handler: async (event) => {
        return successResponse({ users: [] });
      }
    },
    '/users/{id}': {
      handler: async (event) => {
        const userId = event.params.id;
        return successResponse({ id: userId, name: 'John' });
      }
    }
  },
  post: {
    '/users': {
      handler: async (event) => {
        const body = event.payload.body;
        return successResponse({ created: true, data: body });
      }
    }
  }
};

export const handler = async (event: any) => {
  return dispatchEvent(event, { apigateway: routes });
};
```

### Segmented Routes (Recommended)

Organize routes by security context for cleaner code and automatic validation:

```typescript
import { 
  dispatchEvent, 
  SegmentedHttpRouter, 
  successResponse,
  forbiddenResponse 
} from 'serverless-event-orchestrator';

const routes: SegmentedHttpRouter = {
  // No authentication required
  public: {
    post: {
      '/auth/login': { handler: loginHandler },
      '/auth/register': { handler: registerHandler }
    }
  },
  
  // Requires authenticated user (Client User Pool)
  private: {
    get: {
      '/me': { handler: getProfileHandler },
      '/orders': { handler: getOrdersHandler }
    },
    put: {
      '/me': { handler: updateProfileHandler }
    }
  },
  
  // Requires admin user (Backoffice User Pool)
  backoffice: {
    get: {
      '/admin/users': { handler: listAllUsersHandler }
    },
    delete: {
      '/admin/users/{id}': { handler: deleteUserHandler }
    }
  },
  
  // Internal Lambda-to-Lambda calls
  internal: {
    post: {
      '/internal/sync': { handler: syncDataHandler }
    }
  }
};

export const handler = async (event: any) => {
  return dispatchEvent(event, { apigateway: routes }, {
    debug: process.env.DEBUG === 'true',
    autoExtractIdentity: true,
    jwtVerification: {
      private: {
        userPoolId: process.env.USER_POOL_ID!,
        clientId: null,
      },
      backoffice: {
        userPoolId: process.env.ADMIN_POOL_ID!,
        clientId: null,
      },
    },
  });
};
```

### With Middleware

```typescript
import { 
  AdvancedSegmentedRouter,
  NormalizedEvent,
  forbiddenResponse
} from 'serverless-event-orchestrator';

// Custom middleware
const validateAdminRole = async (event: NormalizedEvent) => {
  const groups = event.context.identity?.groups ?? [];
  if (!groups.includes('Admins')) {
    throw forbiddenResponse('Admin role required');
  }
  return event;
};

const routes: AdvancedSegmentedRouter = {
  public: {
    routes: {
      get: { '/health': { handler: healthCheck } }
    }
  },
  backoffice: {
    middleware: [validateAdminRole],
    routes: {
      get: { '/admin/dashboard': { handler: dashboardHandler } }
    }
  }
};
```

## Handling Multiple Event Types

```typescript
import { dispatchEvent, DispatchRoutes, NormalizedEvent } from 'serverless-event-orchestrator';

const routes: DispatchRoutes = {
  // HTTP routes
  apigateway: {
    public: {
      get: { '/status': { handler: statusHandler } }
    }
  },
  
  // EventBridge events
  eventbridge: {
    'user.created': async (event: NormalizedEvent) => {
      console.log('User created:', event.payload.body);
    },
    'order.completed': async (event: NormalizedEvent) => {
      console.log('Order completed:', event.payload.body);
    },
    default: async (event: NormalizedEvent) => {
      console.log('Unknown event:', event.payload.body);
    }
  },
  
  // SQS queues
  sqs: {
    'notification-queue': async (event: NormalizedEvent) => {
      console.log('Notification:', event.payload.body);
    },
    default: async (event: NormalizedEvent) => {
      console.log('Unknown queue message:', event.payload.body);
    }
  },

  // Scheduled events (EventBridge Scheduler / CloudWatch Events rules)
  scheduled: {
    // Route by rule name (extracted from the event's resources ARN)
    'MyDailyCronRule': async (event: NormalizedEvent) => {
      console.log('Daily cron triggered, rule:', event.params.ruleName);
    },
    // Fallback for any unmatched scheduled event
    default: async (event: NormalizedEvent) => {
      console.log('Scheduled event:', event.params.ruleName);
    }
  }
};

export const handler = async (event: any) => {
  return dispatchEvent(event, routes);
};
```

## Scheduled Events

Supports EventBridge Scheduler and CloudWatch Events rules (cron/rate expressions). Events with `source: "aws.events"` and `detail-type: "Scheduled Event"` are automatically detected and routed.

```typescript
import { dispatchEvent, DispatchRoutes, ScheduledRoutes } from 'serverless-event-orchestrator';

const scheduledRouter: ScheduledRoutes = {
  // Route by rule name (extracted from resources ARN)
  'PropertyExpirationSchedule': async (event) => {
    // Run expiration logic
    return { statusCode: 200, body: 'OK' };
  },
  // Fallback handler
  default: async (event) => {
    console.log('Unhandled scheduled event:', event.params.ruleName);
  }
};

const routes: DispatchRoutes = {
  apigateway: httpRouter,
  scheduled: scheduledRouter,
};
```

**How routing works:**
- The rule name is extracted from `event.resources[0]` (the last segment after `/` in the ARN)
- First tries to match by exact rule name, then falls back to `default`
- The rule name is available in `event.params.ruleName`
- Scheduled events are assigned `segment: "internal"` (no authentication required)

**SAM template example:**
```yaml
Events:
  MyCronRule:
    Type: Schedule
    Properties:
      Schedule: "cron(0 7 * * ? *)"
      Description: "Run daily at 07:00 UTC"
      Enabled: true
```

## Response Utilities

Built-in response helpers for consistent API responses:

```typescript
import {
  successResponse,
  createdResponse,
  badRequestResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
  validationErrorResponse,
  internalErrorResponse,
  customErrorResponse
} from 'serverless-event-orchestrator';

// Success responses
successResponse({ user: { id: 1 } });
// { statusCode: 200, body: '{"status":200,"code":"SUCCESS","data":{"user":{"id":1}}}' }

createdResponse({ id: 123 });
// { statusCode: 201, body: '{"status":201,"code":"CREATED","data":{"id":123}}' }

// Error responses
badRequestResponse('Invalid email format');
notFoundResponse('User not found');

// Custom error codes (your domain-specific codes)
enum MyErrorCodes {
  USER_SUSPENDED = 'USER_SUSPENDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED'
}

const codeToStatus = {
  [MyErrorCodes.USER_SUSPENDED]: 403,
  [MyErrorCodes.QUOTA_EXCEEDED]: 429
};

customErrorResponse(MyErrorCodes.QUOTA_EXCEEDED, 'API quota exceeded', codeToStatus);
```

## Identity & Security

### JWT Signature Verification (v2.0+)

JWTs from the `Authorization` header are cryptographically verified against Cognito's JWKS endpoint using [`aws-jwt-verify`](https://github.com/awslabs/aws-jwt-verify). This prevents accepting fabricated tokens with arbitrary claims.

```typescript
export const handler = async (event: any) => {
  return dispatchEvent(event, { apigateway: routes }, {
    autoExtractIdentity: true,
    jwtVerification: {
      // Verify tokens for private routes against the Portal User Pool
      private: {
        userPoolId: process.env.COGNITO_PORTAL_USER_POOL_ID!,
        clientId: null,         // null = skip client ID check
      },
      // Verify tokens for backoffice routes against the Backoffice User Pool
      backoffice: {
        userPoolId: process.env.COGNITO_BACKOFFICE_USER_POOL_ID!,
        clientId: null,
      },
    },
  });
};
```

**How it works:**

- If `event.requestContext.authorizer.claims` exists (API Gateway authorizer), those claims are used directly (already verified by API Gateway)
- If no authorizer claims exist and `autoExtractIdentity` + `jwtVerification` are configured, the `Authorization` header JWT is verified cryptographically
- If verification fails, the dispatcher returns **401 Unauthorized**
- Public and internal segments don't require `jwtVerification`
- JWKS keys are cached at the module level (persists across Lambda warm starts)

**`JwtVerificationPoolConfig` options:**

| Property | Type | Description |
|----------|------|-------------|
| `userPoolId` | `string` | Cognito User Pool ID (e.g., `us-east-1_ABC123`) |
| `clientId` | `string \| string[] \| null` | App Client ID(s). `null` to skip client ID verification |
| `tokenUse` | `'id' \| 'access' \| null` | Expected token type. `null` to accept either |

### Working with Identity in Handlers

```typescript
import {
  hasAnyGroup,
  hasAllGroups
} from 'serverless-event-orchestrator';

const myHandler = async (event: NormalizedEvent) => {
  const identity = event.context.identity;

  // Access user info
  console.log(identity?.userId);   // Cognito sub
  console.log(identity?.email);    // User email
  console.log(identity?.groups);   // Cognito groups
  console.log(identity?.claims);   // All JWT claims

  // Check groups
  if (hasAnyGroup(identity, ['Admins', 'Moderators'])) {
    // User has admin or moderator role
  }

  if (hasAllGroups(identity, ['Premium', 'Verified'])) {
    // User has both premium and verified status
  }
};
```

## CORS Handling

```typescript
import { withCors, applyCorsHeaders } from 'serverless-event-orchestrator';

// Option 1: Wrap handler
const handler = withCors(async (event) => {
  return successResponse({ data: 'Hello' });
}, {
  origins: ['https://myapp.com', 'https://admin.myapp.com'],
  credentials: true,
  maxAge: 86400
});

// Option 2: Apply to response
const response = successResponse({ data: 'Hello' });
return applyCorsHeaders(response, { origins: '*' });
```

## Configuration

```typescript
import { dispatchEvent, OrchestratorConfig } from 'serverless-event-orchestrator';

const config: OrchestratorConfig = {
  // Enable debug logging
  debug: process.env.NODE_ENV !== 'production',
  
  // Extract identity from Authorization header JWT
  autoExtractIdentity: true,

  // JWT signature verification per segment (v2.0+)
  jwtVerification: {
    private: {
      userPoolId: 'us-east-1_ABC123',
      clientId: null,
    },
    backoffice: {
      userPoolId: 'us-east-1_XYZ789',
      clientId: null,
    },
  },
  
  // Global middleware (runs for all routes)
  globalMiddleware: [
    async (event) => {
      console.log('Request:', event.context.requestId);
      return event;
    }
  ],
  
  // Custom response handlers
  responses: {
    notFound: () => ({ statusCode: 404, body: JSON.stringify({ error: 'Not found' }) }),
    forbidden: () => ({ statusCode: 403, body: JSON.stringify({ error: 'Access denied' }) })
  }
};

export const handler = async (event: any) => {
  return dispatchEvent(event, routes, config);
};
```

## API Reference

### Core Functions

| Function | Description |
|----------|-------------|
| `dispatchEvent(event, routes, config?)` | Main dispatcher function |
| `createOrchestrator(config)` | Creates a pre-configured dispatcher |
| `detectEventType(event)` | Detects AWS event type |

### Response Helpers

| Function | Status Code |
|----------|-------------|
| `successResponse(data?, code?)` | 200 |
| `createdResponse(data?, code?)` | 201 |
| `badRequestResponse(message?, code?)` | 400 |
| `unauthorizedResponse(message?, code?)` | 401 |
| `forbiddenResponse(message?, code?)` | 403 |
| `notFoundResponse(message?, code?)` | 404 |
| `conflictResponse(message?, code?)` | 409 |
| `validationErrorResponse(message?, code?)` | 422 |
| `internalErrorResponse(message?, code?)` | 500 |

### Identity Functions

| Function | Description |
|----------|-------------|
| `extractIdentity(event, options?)` | Extracts and verifies Cognito claims (async) |
| `verifyJwt(token, poolConfig)` | Verifies a JWT against Cognito JWKS |
| `validateIssuer(identity, userPoolId)` | Validates token issuer |
| `hasAnyGroup(identity, groups)` | Checks if user has any of the groups |
| `hasAllGroups(identity, groups)` | Checks if user has all groups |

## TypeScript Support

All types are exported for full TypeScript support:

```typescript
import type {
  HttpRouter,
  SegmentedHttpRouter,
  AdvancedSegmentedRouter,
  NormalizedEvent,
  IdentityContext,
  RouteConfig,
  OrchestratorConfig,
  JwtVerificationPoolConfig,
  MiddlewareFn,
  ScheduledRoutes
} from 'serverless-event-orchestrator';
```

## License

MIT 2024
