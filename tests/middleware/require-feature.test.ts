import { requireFeature } from '../../src/middleware/require-feature';
import { RouteSegment } from '../../src/types/event-type.enum';
import type { NormalizedEvent } from '../../src/types/routes';

function createEvent(options: {
  features?: string | string[];
  groups?: string[];
}): NormalizedEvent {
  const claims: Record<string, any> = {};
  if (options.features !== undefined) {
    claims.features = options.features;
  }

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
        claims,
      },
      requestId: 'req-test',
    },
  };
}

describe('requireFeature', () => {
  it('allows access when the required code is present (CSV claim)', async () => {
    const mw = requireFeature('aiDescriptions');
    const event = createEvent({ features: 'virtualTours,aiDescriptions,bulkExport' });
    const result = await mw(event);
    expect(result).toBeDefined();
  });

  it('allows access when the required code is present (array claim)', async () => {
    const mw = requireFeature('aiDescriptions');
    const event = createEvent({ features: ['virtualTours', 'aiDescriptions'] });
    const result = await mw(event);
    expect(result).toBeDefined();
  });

  it('throws 403 when the required code is missing', async () => {
    const mw = requireFeature('aiDescriptions');
    const event = createEvent({ features: 'virtualTours,bulkExport' });
    await expect(mw(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 403 when the features claim is absent', async () => {
    const mw = requireFeature('aiDescriptions');
    const event = createEvent({});
    await expect(mw(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('error body includes FEATURE_NOT_IN_PLAN code and the missing feature', async () => {
    const mw = requireFeature('bulkExport');
    const event = createEvent({ features: 'aiDescriptions' });
    try {
      await mw(event);
      fail('Should have thrown');
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
      const body = JSON.parse(err.body);
      expect(body.code).toBe('FEATURE_NOT_IN_PLAN');
      expect(body.message).toContain('bulkExport');
    }
  });

  it('PLATFORM_ADMIN bypasses the feature check even with no features claim', async () => {
    const mw = requireFeature('aiDescriptions');
    const event = createEvent({ groups: ['PLATFORM_ADMIN'] });
    const result = await mw(event);
    expect(result).toBeDefined();
  });

  it('accepts string[] arg and passes when ANY required code is present', async () => {
    const mw = requireFeature(['virtualTours', 'aiDescriptions']);
    const event = createEvent({ features: 'bulkExport,aiDescriptions' });
    const result = await mw(event);
    expect(result).toBeDefined();
  });

  it('throws 403 with string[] arg when NONE of the required codes are present', async () => {
    const mw = requireFeature(['virtualTours', 'aiDescriptions']);
    const event = createEvent({ features: 'bulkExport,advancedSearch' });
    await expect(mw(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('trims whitespace in CSV claim values', async () => {
    const mw = requireFeature('aiDescriptions');
    const event = createEvent({ features: ' virtualTours , aiDescriptions , bulkExport ' });
    const result = await mw(event);
    expect(result).toBeDefined();
  });
});

describe('requireFeature barrel exports', () => {
  it('is exported from the middleware barrel', async () => {
    const barrel = await import('../../src/middleware/index');
    expect(typeof barrel.requireFeature).toBe('function');
  });

  it('is exported from the root barrel', async () => {
    const root = await import('../../src/index');
    expect(typeof root.requireFeature).toBe('function');
  });
});
