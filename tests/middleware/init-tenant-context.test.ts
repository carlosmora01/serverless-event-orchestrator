import { initTenantContext } from '../../src/middleware/init-tenant-context';
import { TenantContext } from '../../src/tenant';
import { RouteSegment } from '../../src/types/event-type.enum';
import type { NormalizedEvent } from '../../src/types/routes';

function createMockEvent(overrides: Partial<{
  segment: RouteSegment;
  claims: Record<string, any>;
  headers: Record<string, string>;
  userId: string;
  groups: string[];
}>): NormalizedEvent {
  return {
    eventRaw: {},
    eventType: 'apigateway',
    payload: {
      body: {},
      pathParameters: {},
      queryStringParameters: {},
      headers: overrides.headers ?? {},
    },
    params: {},
    context: {
      segment: overrides.segment ?? RouteSegment.Private,
      identity: overrides.claims ? {
        userId: overrides.userId ?? 'user-1',
        groups: overrides.groups ?? [],
        claims: overrides.claims,
      } : undefined,
      requestId: 'req-test',
    },
  };
}

describe('initTenantContext', () => {
  afterEach(() => {
    TenantContext._reset();
  });

  describe('from JWT claims (private/backoffice)', () => {
    it('extracts tenantInfo from identity.claims and adds to context.tenantInfo', async () => {
      const event = createMockEvent({
        segment: RouteSegment.Private,
        claims: {
          'custom:tenantId': 'org_abc',
          'custom:tenantType': 'ORG',
          'custom:userId': 'user-1',
          'custom:countryCode': 'CO',
          'custom:personProfileId': 'person_1',
          'custom:orgProfileId': 'org_abc',
          'custom:plan': 'PRO',
          'custom:hasCRM': 'true',
        },
      });

      const result = await initTenantContext(event) as NormalizedEvent;

      expect(result.context.tenantInfo).toBeDefined();
      expect(result.context.tenantInfo?.tenantId).toBe('org_abc');
      expect(result.context.tenantInfo?.tenantType).toBe('ORG');
      expect(result.context.tenantInfo?.countryCode).toBe('CO');
      expect(result.context.tenantInfo?.plan).toBe('PRO');
      expect(result.context.tenantInfo?.hasCRM).toBe(true);
    });

    it('initializes TenantContext (AsyncLocalStorage)', async () => {
      const event = createMockEvent({
        claims: {
          'custom:tenantId': 'org_abc',
          'custom:tenantType': 'ORG',
          'custom:userId': 'user-1',
          'custom:countryCode': 'CO',
        },
      });

      await initTenantContext(event);

      expect(TenantContext.isActive()).toBe(true);
      expect(TenantContext.current().tenantId).toBe('org_abc');
    });

    it('handles incomplete claims without error (returns event without tenantInfo)', async () => {
      const event = createMockEvent({
        claims: { 'custom:tenantId': 'org_abc' }, // missing tenantType, userId, countryCode
      });

      const result = await initTenantContext(event) as NormalizedEvent;

      expect(result.context.tenantInfo).toBeUndefined();
    });
  });

  describe('from headers (internal/Lambda-to-Lambda)', () => {
    it('extracts tenantInfo from x-tenant-* headers', async () => {
      const event = createMockEvent({
        segment: RouteSegment.Internal,
        headers: {
          'x-tenant-id': 'org_xyz',
          'x-tenant-type': 'ORG',
          'x-user-id': 'user-2',
          'x-country-code': 'MX',
        },
      });

      const result = await initTenantContext(event) as NormalizedEvent;

      expect(result.context.tenantInfo?.tenantId).toBe('org_xyz');
      expect(result.context.tenantInfo?.tenantType).toBe('ORG');
    });
  });

  describe('public routes (no authentication)', () => {
    it('returns event without tenantInfo when no claims or headers', async () => {
      const event = createMockEvent({
        segment: RouteSegment.Public,
      });

      const result = await initTenantContext(event) as NormalizedEvent;

      expect(result.context.tenantInfo).toBeUndefined();
      expect(TenantContext.isActive()).toBe(false);
    });
  });

  describe('priority: claims > headers', () => {
    it('uses claims if both are present', async () => {
      const event = createMockEvent({
        claims: {
          'custom:tenantId': 'org_from_claims',
          'custom:tenantType': 'ORG',
          'custom:userId': 'user-1',
          'custom:countryCode': 'CO',
        },
        headers: {
          'x-tenant-id': 'org_from_headers',
          'x-tenant-type': 'PERSON',
          'x-user-id': 'user-2',
          'x-country-code': 'MX',
        },
      });

      const result = await initTenantContext(event) as NormalizedEvent;

      expect(result.context.tenantInfo?.tenantId).toBe('org_from_claims');
    });
  });
});
