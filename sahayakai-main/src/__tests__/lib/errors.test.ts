import {
  BaseError,
  FlowExecutionError,
  SchemaValidationError,
  PersistenceError,
  InputValidationError,
  RateLimitError,
  AuthenticationError,
  NetworkError,
} from '@/lib/errors';

describe('Custom Errors', () => {
  describe('BaseError', () => {
    it('should correctly construct a BaseError', () => {
      const error = new BaseError('Base message', 'BASE-001', { info: 'context' });
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BaseError);
      expect(error.name).toBe('BaseError');
      expect(error.message).toBe('Base message');
      expect(error.errorCode).toBe('BASE-001');
      expect(error.context).toEqual({ info: 'context' });
    });

    it('should produce correct JSON output', () => {
      const error = new BaseError('Base message', 'BASE-001', { info: 'context' });
      const json = error.toJSON();
      expect(json.name).toBe('BaseError');
      expect(json.message).toBe('Base message');
      expect(json.errorCode).toBe('BASE-001');
      expect(json.context).toEqual({ info: 'context' });
      expect(json.stack).toBeDefined();
    });
  });

  describe('FlowExecutionError', () => {
    it('should construct with the correct name and error code', () => {
      const error = new FlowExecutionError('Flow failed', { step: 'one' });
      expect(error.name).toBe('FlowExecutionError');
      expect(error.message).toBe('Flow failed');
      expect(error.errorCode).toBe('AI-FLOW-001');
      expect(error.context).toEqual({ step: 'one' });
    });
  });

  describe('SchemaValidationError', () => {
    it('should construct with validation errors in context', () => {
      const validationErrors = [{ field: 'name', message: 'is required' }];
      const error = new SchemaValidationError('Schema is invalid', validationErrors);
      expect(error.name).toBe('SchemaValidationError');
      expect(error.errorCode).toBe('AI-SCHEMA-001');
      expect(error.validationErrors).toEqual(validationErrors);
      expect(error.context).toEqual({ validationErrors });
    });
  });

  describe('PersistenceError', () => {
    it('should construct with operation in context', () => {
      const error = new PersistenceError('Failed to save', 'user-profile');
      expect(error.name).toBe('PersistenceError');
      expect(error.errorCode).toBe('DB-PERSIST-001');
      expect(error.operation).toBe('user-profile');
      expect(error.context).toEqual({ operation: 'user-profile' });
    });
  });

  describe('InputValidationError', () => {
    it('should construct with validation errors in context', () => {
      const validationErrors = [{ param: 'id', message: 'not a UUID' }];
      const error = new InputValidationError('Invalid input', validationErrors);
      expect(error.name).toBe('InputValidationError');
      expect(error.errorCode).toBe('API-INPUT-001');
      expect(error.validationErrors).toEqual(validationErrors);
      expect(error.context).toEqual({ validationErrors });
    });
  });

  describe('RateLimitError', () => {
    it('should construct with retryAfter in context', () => {
      const error = new RateLimitError('Too many requests', 60);
      expect(error.name).toBe('RateLimitError');
      expect(error.errorCode).toBe('API-RATE-001');
      expect(error.retryAfter).toBe(60);
      expect(error.context).toEqual({ retryAfter: 60 });
    });
  });

  describe('AuthenticationError', () => {
    it('should construct with the correct name and error code', () => {
      const error = new AuthenticationError('Invalid token', { userId: '123' });
      expect(error.name).toBe('AuthenticationError');
      expect(error.message).toBe('Invalid token');
      expect(error.errorCode).toBe('AUTH-TOKEN-001');
      expect(error.context).toEqual({ userId: '123' });
    });
  });

  describe('NetworkError', () => {
    it('should construct with the correct name and error code', () => {
      const error = new NetworkError('Request timed out', { url: 'https://example.com' });
      expect(error.name).toBe('NetworkError');
      expect(error.message).toBe('Request timed out');
      expect(error.errorCode).toBe('NET-CALL-001');
      expect(error.context).toEqual({ url: 'https://example.com' });
    });
  });
});
