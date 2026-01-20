import {
  extractIdentity,
  extractUserPoolId,
  validateIssuer,
  hasAnyGroup,
  hasAllGroups
} from '../src/identity/extractor';
import { IdentityContext } from '../src/types/routes';

describe('extractIdentity', () => {
  it('should return undefined when no claims present', () => {
    const event = { requestContext: {} };
    expect(extractIdentity(event)).toBeUndefined();
  });

  it('should return undefined when event has no requestContext', () => {
    const event = {};
    expect(extractIdentity(event)).toBeUndefined();
  });

  it('should extract identity from Cognito claims', () => {
    const event = {
      requestContext: {
        authorizer: {
          claims: {
            sub: 'user-123',
            email: 'user@example.com',
            'cognito:groups': 'Admin,User',
            iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123'
          }
        }
      }
    };

    const identity = extractIdentity(event);

    expect(identity).toEqual({
      userId: 'user-123',
      email: 'user@example.com',
      groups: ['Admin', 'User'],
      issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123',
      claims: event.requestContext.authorizer.claims
    });
  });

  it('should handle cognito:username as userId fallback', () => {
    const event = {
      requestContext: {
        authorizer: {
          claims: {
            'cognito:username': 'john_doe'
          }
        }
      }
    };

    const identity = extractIdentity(event);
    expect(identity?.userId).toBe('john_doe');
  });

  it('should handle groups as array', () => {
    const event = {
      requestContext: {
        authorizer: {
          claims: {
            sub: 'user-123',
            'cognito:groups': ['Admin', 'User']
          }
        }
      }
    };

    const identity = extractIdentity(event);
    expect(identity?.groups).toEqual(['Admin', 'User']);
  });

  // HTTP API with JWT Authorizer tests
  it('should extract identity from HTTP API JWT Authorizer format', () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: 'user-456',
              email: 'jwt@example.com',
              iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_JWT123'
            }
          }
        }
      }
    };

    const identity = extractIdentity(event);

    expect(identity).toEqual({
      userId: 'user-456',
      email: 'jwt@example.com',
      groups: [],
      issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_JWT123',
      claims: event.requestContext.authorizer.jwt.claims
    });
  });

  // HTTP API with Lambda Authorizer tests
  it('should extract identity from HTTP API Lambda Authorizer format', () => {
    const event = {
      requestContext: {
        authorizer: {
          lambda: {
            userId: 'lambda-user-789',
            email: 'lambda@example.com',
            groups: ['Premium', 'Verified']
          }
        }
      }
    };

    const identity = extractIdentity(event);

    expect(identity?.userId).toBe('lambda-user-789');
    expect(identity?.email).toBe('lambda@example.com');
    expect(identity?.groups).toEqual(['Premium', 'Verified']);
  });

  // REST API with Custom Lambda Authorizer (flat structure)
  it('should extract identity from custom Lambda Authorizer with flat structure', () => {
    const event = {
      requestContext: {
        authorizer: {
          sub: 'custom-user-101',
          email: 'custom@example.com',
          iss: 'https://custom-issuer.com'
        }
      }
    };

    const identity = extractIdentity(event);

    expect(identity?.userId).toBe('custom-user-101');
    expect(identity?.email).toBe('custom@example.com');
    expect(identity?.issuer).toBe('https://custom-issuer.com');
  });

  it('should handle userId fallback from user_id in custom authorizer', () => {
    const event = {
      requestContext: {
        authorizer: {
          user_id: 'underscore-user',
          email: 'test@example.com'
        }
      }
    };

    const identity = extractIdentity(event);
    expect(identity?.userId).toBe('underscore-user');
  });

  it('should return undefined when authorizer has no identity properties', () => {
    const event = {
      requestContext: {
        authorizer: {
          principalId: 'some-principal',
          integrationLatency: 123
        }
      }
    };

    expect(extractIdentity(event)).toBeUndefined();
  });
});

describe('extractUserPoolId', () => {
  it('should extract User Pool ID from issuer URL', () => {
    const issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123';
    expect(extractUserPoolId(issuer)).toBe('us-east-1_ABC123');
  });

  it('should return undefined for undefined issuer', () => {
    expect(extractUserPoolId(undefined)).toBeUndefined();
  });

  it('should handle issuer with trailing slash', () => {
    const issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XYZ789';
    expect(extractUserPoolId(issuer)).toBe('us-east-1_XYZ789');
  });
});

describe('validateIssuer', () => {
  const validIdentity: IdentityContext = {
    userId: 'user-123',
    issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123'
  };

  it('should return true when User Pool matches', () => {
    expect(validateIssuer(validIdentity, 'us-east-1_ABC123')).toBe(true);
  });

  it('should return false when User Pool does not match', () => {
    expect(validateIssuer(validIdentity, 'us-east-1_WRONG')).toBe(false);
  });

  it('should return false when identity is undefined', () => {
    expect(validateIssuer(undefined, 'us-east-1_ABC123')).toBe(false);
  });

  it('should return false when issuer is missing', () => {
    const identity: IdentityContext = { userId: 'user-123' };
    expect(validateIssuer(identity, 'us-east-1_ABC123')).toBe(false);
  });
});

describe('hasAnyGroup', () => {
  const identity: IdentityContext = {
    userId: 'user-123',
    groups: ['User', 'Premium']
  };

  it('should return true if user has any of the allowed groups', () => {
    expect(hasAnyGroup(identity, ['Admin', 'Premium'])).toBe(true);
    expect(hasAnyGroup(identity, ['User'])).toBe(true);
  });

  it('should return false if user has none of the allowed groups', () => {
    expect(hasAnyGroup(identity, ['Admin', 'SuperAdmin'])).toBe(false);
  });

  it('should return false for undefined identity', () => {
    expect(hasAnyGroup(undefined, ['Admin'])).toBe(false);
  });

  it('should return false for identity with no groups', () => {
    const noGroupsIdentity: IdentityContext = { userId: 'user-123' };
    expect(hasAnyGroup(noGroupsIdentity, ['Admin'])).toBe(false);
  });

  it('should return false for empty groups array', () => {
    const emptyGroupsIdentity: IdentityContext = { userId: 'user-123', groups: [] };
    expect(hasAnyGroup(emptyGroupsIdentity, ['Admin'])).toBe(false);
  });
});

describe('hasAllGroups', () => {
  const identity: IdentityContext = {
    userId: 'user-123',
    groups: ['User', 'Premium', 'Verified']
  };

  it('should return true if user has all required groups', () => {
    expect(hasAllGroups(identity, ['User', 'Premium'])).toBe(true);
    expect(hasAllGroups(identity, ['Verified'])).toBe(true);
  });

  it('should return false if user is missing any required group', () => {
    expect(hasAllGroups(identity, ['User', 'Admin'])).toBe(false);
  });

  it('should return false for undefined identity', () => {
    expect(hasAllGroups(undefined, ['Admin'])).toBe(false);
  });

  it('should return false for identity with no groups', () => {
    const noGroupsIdentity: IdentityContext = { userId: 'user-123' };
    expect(hasAllGroups(noGroupsIdentity, ['Admin'])).toBe(false);
  });
});
