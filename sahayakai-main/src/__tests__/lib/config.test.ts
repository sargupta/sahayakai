import { validateEnvironment } from '@/lib/config';

describe('validateEnvironment', () => {
  const originalEnv = process.env;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset modules to clear cache and re-evaluate module-level code
    jest.resetModules();
    // Clone original environment
    process.env = { ...originalEnv };

    // Spy on console and process.exit
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as (code?: number) => never);
  });

  afterEach(() => {
    // Restore original environment and spies
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  const setValidEnv = () => {
    process.env.GOOGLE_GENAI_API_KEY = 'test-key';
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = 'test-key';
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key';
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test-domain';
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'test-bucket';
    process.env.NODE_ENV = 'test';
  };

  it('should return true and log success when all environment variables are set', () => {
    setValidEnv();
    const result = validateEnvironment();
    expect(result).toBe(true);
    expect(consoleLogSpy).toHaveBeenCalledWith('[Config] ✅ Environment validation passed');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('should return false and log errors when an environment variable is missing', () => {
    setValidEnv();
    delete process.env.GOOGLE_GENAI_API_KEY;

    const result = validateEnvironment();
    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[Config] ❌ Environment validation failed:');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('GOOGLE_GENAI_API_KEY: Required'));
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('should not exit process if validation fails in non-production environment', () => {
    process.env.NODE_ENV = 'development';
    // Missing a variable
    delete process.env.GOOGLE_GENAI_API_KEY;

    const result = validateEnvironment();
    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('GOOGLE_GENAI_API_KEY: Required'));
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('should call process.exit(1) if validation fails in production environment', () => {
    setValidEnv();
    process.env.NODE_ENV = 'production';
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    const result = validateEnvironment();
    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[Config] ❌ Environment validation failed:');
    expect(consoleErrorSpy).toHaveBeenCalledWith('[Config] Exiting due to invalid environment configuration');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
