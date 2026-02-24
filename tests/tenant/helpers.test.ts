import {
  isTenantType,
  isPlan,
  tenantInfoFromClaims,
  tenantInfoFromHeaders,
  tenantInfoToHeaders,
  TENANT_HEADERS,
} from '../../src/tenant';
import type { TenantInfo } from '../../src/tenant';

describe('Type Guards', () => {
  describe('isTenantType', () => {
    it('accepts ORG', () => expect(isTenantType('ORG')).toBe(true));
    it('accepts PERSON', () => expect(isTenantType('PERSON')).toBe(true));
    it('rejects invalid string', () => expect(isTenantType('INVALID')).toBe(false));
    it('rejects undefined', () => expect(isTenantType(undefined)).toBe(false));
    it('rejects null', () => expect(isTenantType(null)).toBe(false));
  });

  describe('isPlan', () => {
    it.each(['FREE', 'BASIC', 'PRO', 'ENTERPRISE'])('accepts %s', (plan) => {
      expect(isPlan(plan)).toBe(true);
    });
    it('rejects invalid string', () => expect(isPlan('PREMIUM')).toBe(false));
  });
});

describe('tenantInfoFromClaims', () => {
  const validClaims = {
    'custom:tenantId': 'org_abc',
    'custom:tenantType': 'ORG',
    'custom:userId': 'user_001',
    'custom:countryCode': 'CO',
    'custom:personProfileId': 'person_001',
    'custom:orgProfileId': 'org_abc',
    'custom:plan': 'PRO',
    'custom:hasCRM': 'true',
  };

  it('builds complete TenantInfo from valid claims', () => {
    const result = tenantInfoFromClaims(validClaims);
    expect(result).toEqual({
      tenantId: 'org_abc',
      tenantType: 'ORG',
      userId: 'user_001',
      countryCode: 'CO',
      personProfileId: 'person_001',
      orgProfileId: 'org_abc',
      plan: 'PRO',
      hasCRM: 'true',
    });
  });

  it('returns undefined if tenantId is missing', () => {
    const { 'custom:tenantId': _, ...claims } = validClaims;
    expect(tenantInfoFromClaims(claims)).toBeUndefined();
  });

  it('returns undefined if tenantType is missing', () => {
    const { 'custom:tenantType': _, ...claims } = validClaims;
    expect(tenantInfoFromClaims(claims)).toBeUndefined();
  });

  it('returns undefined if tenantType is invalid', () => {
    expect(tenantInfoFromClaims({ ...validClaims, 'custom:tenantType': 'INVALID' })).toBeUndefined();
  });

  it('hasCRM is false if claim is not "true"', () => {
    const result = tenantInfoFromClaims({ ...validClaims, 'custom:hasCRM': 'false' });
    expect(result?.hasCRM).toBe('false');
  });

  it('plan is undefined if claim is not a valid Plan', () => {
    const result = tenantInfoFromClaims({ ...validClaims, 'custom:plan': 'PREMIUM' });
    expect(result?.plan).toBeUndefined();
  });

  it('uses sub as fallback for userId', () => {
    const claims = {
      'custom:tenantId': 'org_abc',
      'custom:tenantType': 'ORG',
      'sub': 'cognito-sub-123',
      'custom:countryCode': 'CO',
    };
    const result = tenantInfoFromClaims(claims);
    expect(result?.userId).toBe('cognito-sub-123');
  });

  describe('without custom: prefix (Cognito Pre Token Generation V2)', () => {
    const v2Claims = {
      tenantId: 'org_abc',
      tenantType: 'ORG',
      userId: 'user_001',
      countryCode: 'CO',
      personProfileId: 'person_001',
      orgProfileId: 'org_abc',
      plan: 'PRO',
      hasCRM: 'true',
    };

    it('builds complete TenantInfo from claims without custom: prefix', () => {
      const result = tenantInfoFromClaims(v2Claims);
      expect(result).toEqual({
        tenantId: 'org_abc',
        tenantType: 'ORG',
        userId: 'user_001',
        countryCode: 'CO',
        personProfileId: 'person_001',
        orgProfileId: 'org_abc',
        plan: 'PRO',
        hasCRM: 'true',
      });
    });

    it('returns undefined if tenantId is missing (no prefix)', () => {
      const { tenantId: _, ...claims } = v2Claims;
      expect(tenantInfoFromClaims(claims)).toBeUndefined();
    });

    it('returns undefined if tenantType is invalid (no prefix)', () => {
      expect(tenantInfoFromClaims({ ...v2Claims, tenantType: 'INVALID' })).toBeUndefined();
    });

    it('prefers custom: prefix over unprefixed when both exist', () => {
      const mixedClaims = {
        'custom:tenantId': 'from_custom',
        tenantId: 'from_plain',
        'custom:tenantType': 'ORG',
        tenantType: 'PERSON',
        'custom:userId': 'user_custom',
        userId: 'user_plain',
        'custom:countryCode': 'CO',
        countryCode: 'US',
      };
      const result = tenantInfoFromClaims(mixedClaims);
      expect(result?.tenantId).toBe('from_custom');
      expect(result?.tenantType).toBe('ORG');
      expect(result?.userId).toBe('user_custom');
      expect(result?.countryCode).toBe('CO');
    });

    it('uses sub as fallback for userId without prefix', () => {
      const claims = {
        tenantId: 'org_abc',
        tenantType: 'ORG',
        sub: 'cognito-sub-123',
        countryCode: 'CO',
      };
      const result = tenantInfoFromClaims(claims);
      expect(result?.userId).toBe('cognito-sub-123');
    });
  });
});

describe('tenantInfoFromHeaders / tenantInfoToHeaders', () => {
  const tenant: TenantInfo = {
    tenantId: 'org_abc',
    tenantType: 'ORG',
    userId: 'user_001',
    countryCode: 'CO',
    personProfileId: 'person_001',
    orgProfileId: 'org_abc',
  };

  it('roundtrip: toHeaders → fromHeaders returns same TenantInfo', () => {
    const headers = tenantInfoToHeaders(tenant);
    const result = tenantInfoFromHeaders(headers);
    expect(result).toEqual(tenant);
  });

  it('fromHeaders returns undefined if x-tenant-id is missing', () => {
    const headers = tenantInfoToHeaders(tenant);
    delete headers[TENANT_HEADERS.TENANT_ID];
    expect(tenantInfoFromHeaders(headers)).toBeUndefined();
  });

  it('fromHeaders supports lowercase headers (API Gateway normalization)', () => {
    const headers = {
      'x-tenant-id': 'org_abc',
      'x-tenant-type': 'ORG',
      'x-user-id': 'user_001',
      'x-country-code': 'CO',
    };
    const result = tenantInfoFromHeaders(headers);
    expect(result?.tenantId).toBe('org_abc');
  });
});
