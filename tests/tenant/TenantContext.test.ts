import { TenantContext } from '../../src/tenant/TenantContext';
import type { TenantInfo } from '../../src/tenant/types';

const mockTenantORG: TenantInfo = {
  tenantId: 'org_century21',
  tenantType: 'ORG',
  userId: 'user_001',
  personProfileId: 'person_001',
  orgProfileId: 'org_century21',
  countryCode: 'CO',
  plan: 'PRO',
  hasCRM: true,
};

const mockTenantPERSON: TenantInfo = {
  tenantId: 'person_agent_x',
  tenantType: 'PERSON',
  userId: 'user_002',
  personProfileId: 'person_agent_x',
  countryCode: 'MX',
  plan: 'FREE',
  hasCRM: false,
};

describe('TenantContext', () => {
  afterEach(() => {
    TenantContext._reset();
  });

  describe('run() + current()', () => {
    it('stores and retrieves TenantInfo correctly inside callback', async () => {
      await TenantContext.run(mockTenantORG, async () => {
        const tenant = TenantContext.current();
        expect(tenant.tenantId).toBe('org_century21');
        expect(tenant.tenantType).toBe('ORG');
        expect(tenant.userId).toBe('user_001');
        expect(tenant.countryCode).toBe('CO');
        expect(tenant.plan).toBe('PRO');
        expect(tenant.hasCRM).toBe(true);
      });
    });

    it('supports PERSON tenants', async () => {
      await TenantContext.run(mockTenantPERSON, async () => {
        const tenant = TenantContext.current();
        expect(tenant.tenantId).toBe('person_agent_x');
        expect(tenant.tenantType).toBe('PERSON');
        expect(tenant.orgProfileId).toBeUndefined();
      });
    });

    it('isolates context between concurrent calls', async () => {
      const results: string[] = [];

      await Promise.all([
        TenantContext.run(mockTenantORG, async () => {
          await new Promise((r) => setTimeout(r, 10));
          results.push(TenantContext.current().tenantId);
        }),
        TenantContext.run(mockTenantPERSON, async () => {
          await new Promise((r) => setTimeout(r, 5));
          results.push(TenantContext.current().tenantId);
        }),
      ]);

      expect(results).toContain('org_century21');
      expect(results).toContain('person_agent_x');
    });

    it('propagates context to nested async functions', async () => {
      async function nestedFunction(): Promise<string> {
        return TenantContext.current().tenantId;
      }

      await TenantContext.run(mockTenantORG, async () => {
        const result = await nestedFunction();
        expect(result).toBe('org_century21');
      });
    });
  });

  describe('current() — fail-closed', () => {
    it('throws error if not initialized', () => {
      expect(() => TenantContext.current()).toThrow('TenantContext not initialized');
    });

    it('throws error after exiting run() scope', async () => {
      await TenantContext.run(mockTenantORG, async () => {
        expect(TenantContext.current().tenantId).toBe('org_century21');
      });

      // Outside scope → no more context
      expect(() => TenantContext.current()).toThrow('TenantContext not initialized');
    });
  });

  describe('currentOptional()', () => {
    it('returns undefined if no context', () => {
      expect(TenantContext.currentOptional()).toBeUndefined();
    });

    it('returns TenantInfo if context exists', async () => {
      await TenantContext.run(mockTenantORG, async () => {
        const tenant = TenantContext.currentOptional();
        expect(tenant).toBeDefined();
        expect(tenant?.tenantId).toBe('org_century21');
      });
    });
  });

  describe('set()', () => {
    it('sets context in current AsyncLocalStorage scope', async () => {
      await TenantContext.run(mockTenantORG, async () => {
        expect(TenantContext.current().tenantId).toBe('org_century21');

        // Overwrite with set()
        TenantContext.set(mockTenantPERSON);
        expect(TenantContext.current().tenantId).toBe('person_agent_x');
      });
    });
  });

  describe('isActive()', () => {
    it('returns false outside a context', () => {
      expect(TenantContext.isActive()).toBe(false);
    });

    it('returns true inside a context', async () => {
      await TenantContext.run(mockTenantORG, async () => {
        expect(TenantContext.isActive()).toBe(true);
      });
    });
  });
});
