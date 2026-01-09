import {
  HttpStatus,
  DefaultResponseCode,
  createStandardResponse,
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
} from '../src/http/response';

describe('createStandardResponse', () => {
  it('should create response with data', () => {
    const response = createStandardResponse(200, { user: { id: 1 } });
    const body = JSON.parse(response.body);
    
    expect(response.statusCode).toBe(200);
    expect(body.status).toBe(200);
    expect(body.code).toBe(DefaultResponseCode.SUCCESS);
    expect(body.data).toEqual({ user: { id: 1 } });
  });

  it('should create response with custom code', () => {
    const response = createStandardResponse(200, null, 'CUSTOM_CODE');
    const body = JSON.parse(response.body);
    
    expect(body.code).toBe('CUSTOM_CODE');
  });

  it('should create response with message', () => {
    const response = createStandardResponse(400, undefined, undefined, 'Error message');
    const body = JSON.parse(response.body);
    
    expect(body.message).toBe('Error message');
  });

  it('should include custom headers', () => {
    const response = createStandardResponse(200, null, undefined, undefined, {
      'X-Custom-Header': 'value'
    });
    
    expect(response.headers?.['X-Custom-Header']).toBe('value');
    expect(response.headers?.['Content-Type']).toBe('application/json');
  });
});

describe('successResponse', () => {
  it('should return 200 with data', () => {
    const response = successResponse({ items: [1, 2, 3] });
    const body = JSON.parse(response.body);
    
    expect(response.statusCode).toBe(200);
    expect(body.code).toBe(DefaultResponseCode.SUCCESS);
    expect(body.data).toEqual({ items: [1, 2, 3] });
  });

  it('should return 200 without data', () => {
    const response = successResponse();
    expect(response.statusCode).toBe(200);
  });
});

describe('createdResponse', () => {
  it('should return 201 with data', () => {
    const response = createdResponse({ id: 123 });
    const body = JSON.parse(response.body);
    
    expect(response.statusCode).toBe(201);
    expect(body.code).toBe(DefaultResponseCode.CREATED);
    expect(body.data).toEqual({ id: 123 });
  });
});

describe('error responses', () => {
  it('badRequestResponse should return 400', () => {
    const response = badRequestResponse('Invalid input');
    const body = JSON.parse(response.body);
    
    expect(response.statusCode).toBe(400);
    expect(body.code).toBe(DefaultResponseCode.BAD_REQUEST);
    expect(body.message).toBe('Invalid input');
  });

  it('unauthorizedResponse should return 401', () => {
    const response = unauthorizedResponse('Token expired');
    
    expect(response.statusCode).toBe(401);
  });

  it('forbiddenResponse should return 403', () => {
    const response = forbiddenResponse('Access denied');
    
    expect(response.statusCode).toBe(403);
  });

  it('notFoundResponse should return 404', () => {
    const response = notFoundResponse('User not found');
    
    expect(response.statusCode).toBe(404);
  });

  it('conflictResponse should return 409', () => {
    const response = conflictResponse('Email already exists');
    
    expect(response.statusCode).toBe(409);
  });

  it('validationErrorResponse should return 422', () => {
    const response = validationErrorResponse('Invalid email format');
    
    expect(response.statusCode).toBe(422);
  });

  it('internalErrorResponse should return 500', () => {
    const response = internalErrorResponse('Something went wrong');
    
    expect(response.statusCode).toBe(500);
  });
});

describe('customErrorResponse', () => {
  enum MyErrorCodes {
    USER_SUSPENDED = 'USER_SUSPENDED',
    QUOTA_EXCEEDED = 'QUOTA_EXCEEDED'
  }

  const codeToStatus: Record<MyErrorCodes, HttpStatus> = {
    [MyErrorCodes.USER_SUSPENDED]: HttpStatus.FORBIDDEN,
    [MyErrorCodes.QUOTA_EXCEEDED]: HttpStatus.UNPROCESSABLE_ENTITY
  };

  it('should map custom code to correct status', () => {
    const response = customErrorResponse(
      MyErrorCodes.USER_SUSPENDED,
      'Account suspended',
      codeToStatus
    );
    const body = JSON.parse(response.body);
    
    expect(response.statusCode).toBe(403);
    expect(body.code).toBe('USER_SUSPENDED');
    expect(body.message).toBe('Account suspended');
  });

  it('should default to 500 for unmapped codes', () => {
    const response = customErrorResponse('UNKNOWN_CODE', 'Unknown error');
    
    expect(response.statusCode).toBe(500);
  });
});
