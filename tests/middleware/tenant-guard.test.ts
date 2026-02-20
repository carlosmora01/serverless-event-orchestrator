import { tenantGuard } from '../../src/middleware/tenant-guard';
import { RouteSegment } from '../../src/types/event-type.enum';
import type { NormalizedEvent } from '../../src/types/routes';
import type { TenantInfo } from '../../src/tenant';

function createEvent(options: {
  tenantInfo?: TenantInfo;
  groups?: string[];
}): NormalizedEvent {
  return {
    eventRaw: {},
    eventType: 'apigateway',
    payload: { headers: {} },
    params: {},
    context: {
      segment: RouteSegment.Private,
      identity: {
        userId: 'user-1',
        groups: options.groups ?? [],
        claims: {},
      },
      requestId: 'req-test',
      tenantInfo: options.tenantInfo,
    },
  };
}

const mockTenant: TenantInfo = {
  tenantId: 'org_abc',
  tenantType: 'ORG',
  userId: 'user-1',
  countryCode: 'CO',
};

describe('tenantGuard', () => {
  it('allows access when tenantInfo exists', async () => {
    const event = createEvent({ tenantInfo: mockTenant });
    const result = await tenantGuard(event) as NormalizedEvent;
    expect(result).toBeDefined();
    expect(result.context.tenantInfo?.tenantId).toBe('org_abc');
  });

  it('throws 403 when no tenantInfo and not PLATFORM_ADMIN', async () => {
    const event = createEvent({ groups: ['AGENT'] });
    await expect(tenantGuard(event)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('throws 403 when no tenantInfo and no groups', async () => {
    const event = createEvent({});
    await expect(tenantGuard(event)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('throws 403 when tenantId is empty string', async () => {
    const event = createEvent({ 
      tenantInfo: { ...mockTenant, tenantId: '' }
    });
    await expect(tenantGuard(event)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('throws 403 when tenantId is whitespace only', async () => {
    const event = createEvent({ 
      tenantInfo: { ...mockTenant, tenantId: '   ' }
    });
    await expect(tenantGuard(event)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('error includes TENANT_CONTEXT_MISSING code', async () => {
    const event = createEvent({ groups: ['ORG_ADMIN'] });
    try {
      await tenantGuard(event);
      fail('Should have thrown');
    } catch (err: any) {
      const body = JSON.parse(err.body);
      expect(body.code).toBe('TENANT_CONTEXT_MISSING');
    }
  });

  it('allows PLATFORM_ADMIN without tenantInfo (cross-tenant)', async () => {
    const event = createEvent({ groups: ['PLATFORM_ADMIN'] });
    const result = await tenantGuard(event);
    expect(result).toBeDefined();
  });

  it('allows PLATFORM_ADMIN with tenantInfo', async () => {
    const event = createEvent({
      tenantInfo: mockTenant,
      groups: ['PLATFORM_ADMIN'],
    });
    const result = await tenantGuard(event) as NormalizedEvent;
    expect(result.context.tenantInfo?.tenantId).toBe('org_abc');
  });
});
