import { requirePermission } from '../../src/middleware/require-permission';
import { RouteSegment } from '../../src/types/event-type.enum';
import type { NormalizedEvent } from '../../src/types/routes';

function createEvent(options: {
  permissions?: string | string[];
  groups?: string[];
}): NormalizedEvent {
  const claims: Record<string, any> = {};
  if (options.permissions !== undefined) {
    claims.permissions = options.permissions;
  }

  return {
    eventRaw: {},
    eventType: 'apigateway',
    payload: { headers: {} },
    params: {},
    context: {
      segment: RouteSegment.Backoffice,
      identity: {
        userId: 'user-1',
        groups: options.groups ?? [],
        claims,
      },
      requestId: 'req-test',
    },
  };
}

describe('requirePermission', () => {
  it('allows access when the required code is present (CSV claim)', async () => {
    const mw = requirePermission('MANAGE_PLANS');
    const event = createEvent({ permissions: 'READ_PROPERTY,MANAGE_PLANS,MANAGE_ROLES' });
    const result = await mw(event);
    expect(result).toBeDefined();
  });

  it('allows access when the required code is present (array claim)', async () => {
    const mw = requirePermission('MANAGE_PLANS');
    const event = createEvent({ permissions: ['READ_PROPERTY', 'MANAGE_PLANS'] });
    const result = await mw(event);
    expect(result).toBeDefined();
  });

  it('throws 403 when the required code is missing', async () => {
    const mw = requirePermission('MANAGE_PLANS');
    const event = createEvent({ permissions: 'READ_PROPERTY,CREATE_PROPERTY' });
    await expect(mw(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 403 when the permissions claim is absent', async () => {
    const mw = requirePermission('MANAGE_PLANS');
    const event = createEvent({});
    await expect(mw(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('error body includes PERMISSION_DENIED code and the missing permission', async () => {
    const mw = requirePermission('MANAGE_PERMISSIONS');
    const event = createEvent({ permissions: 'READ_PROPERTY' });
    try {
      await mw(event);
      fail('Should have thrown');
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
      const body = JSON.parse(err.body);
      expect(body.code).toBe('PERMISSION_DENIED');
      expect(body.message).toContain('MANAGE_PERMISSIONS');
    }
  });

  it('PLATFORM_ADMIN bypasses the permission check even with no permissions claim', async () => {
    const mw = requirePermission('MANAGE_PLANS');
    const event = createEvent({ groups: ['PLATFORM_ADMIN'] });
    const result = await mw(event);
    expect(result).toBeDefined();
  });

  it('accepts string[] arg and passes when ANY required code is present', async () => {
    const mw = requirePermission(['MANAGE_ROLES', 'MANAGE_USERS']);
    const event = createEvent({ permissions: 'READ_PROPERTY,MANAGE_USERS' });
    const result = await mw(event);
    expect(result).toBeDefined();
  });

  it('throws 403 with string[] arg when NONE of the required codes are present', async () => {
    const mw = requirePermission(['MANAGE_ROLES', 'MANAGE_USERS']);
    const event = createEvent({ permissions: 'READ_PROPERTY,CREATE_PROPERTY' });
    await expect(mw(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('trims whitespace in CSV claim values', async () => {
    const mw = requirePermission('MANAGE_PLANS');
    const event = createEvent({ permissions: ' READ_PROPERTY , MANAGE_PLANS , MANAGE_ROLES ' });
    const result = await mw(event);
    expect(result).toBeDefined();
  });
});

describe('requirePermission barrel exports', () => {
  it('is exported from the middleware barrel', async () => {
    const barrel = await import('../../src/middleware/index');
    expect(typeof barrel.requirePermission).toBe('function');
  });

  it('is exported from the root barrel', async () => {
    const root = await import('../../src/index');
    expect(typeof root.requirePermission).toBe('function');
  });
});
