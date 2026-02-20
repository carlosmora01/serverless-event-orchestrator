import { crmGuard } from '../../src/middleware/crm-guard';
import { RouteSegment } from '../../src/types/event-type.enum';
import type { NormalizedEvent } from '../../src/types/routes';
import type { TenantInfo } from '../../src/tenant';

function createEvent(options: {
  hasCRM?: boolean;
  groups?: string[];
}): NormalizedEvent {
  const tenantInfo: TenantInfo = {
    tenantId: 'org_abc',
    tenantType: 'ORG',
    userId: 'user-1',
    countryCode: 'CO',
    hasCRM: options.hasCRM,
  };

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
      tenantInfo,
    },
  };
}

describe('crmGuard', () => {
  it('allows access when hasCRM is true', async () => {
    const event = createEvent({ hasCRM: true });
    const result = await crmGuard(event);
    expect(result).toBeDefined();
  });

  it('throws 403 when hasCRM is false', async () => {
    const event = createEvent({ hasCRM: false });
    await expect(crmGuard(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 403 when hasCRM is undefined', async () => {
    const event = createEvent({});
    await expect(crmGuard(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('PLATFORM_ADMIN bypasses CRM check', async () => {
    const event = createEvent({ hasCRM: false, groups: ['PLATFORM_ADMIN'] });
    const result = await crmGuard(event);
    expect(result).toBeDefined();
  });

  it('error includes CRM_ACCESS_DENIED code', async () => {
    const event = createEvent({ hasCRM: false, groups: ['ORG_ADMIN'] });
    try {
      await crmGuard(event);
      fail('Should have thrown');
    } catch (err: any) {
      const body = JSON.parse(err.body);
      expect(body.code).toBe('CRM_ACCESS_DENIED');
    }
  });
});
