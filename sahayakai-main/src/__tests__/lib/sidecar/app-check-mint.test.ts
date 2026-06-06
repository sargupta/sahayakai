/**
 * Unit tests for src/lib/sidecar/app-check-mint.ts (Q4A — AppCheck restore).
 *
 * Covers:
 *  - First-mint path calls firebase-admin appCheck().createToken()
 *  - Cache hit path returns the cached token without re-minting
 *  - Cache refresh when token enters the 10-min expiry buffer
 *  - Mint failure throws AppCheckMintError; safe wrapper returns null
 */

const mockCreateToken = jest.fn();
const mockGetAppCheck = jest.fn(() => ({ createToken: mockCreateToken }));
const mockGetApp = jest.fn(() => ({ name: 'test-admin-app' }));

jest.mock('firebase-admin/app', () => ({
  getApp: (...args: unknown[]) => mockGetApp(...args),
}));

jest.mock('firebase-admin/app-check', () => ({
  getAppCheck: (...args: unknown[]) => mockGetAppCheck(...args),
}));

jest.mock('@/lib/firebase-admin', () => ({
  initializeFirebase: jest.fn().mockResolvedValue(undefined),
}));

import {
  AppCheckMintError,
  _resetAppCheckMintCacheForTest,
  getServerAppCheckTokenOrNull,
  mintServerAppCheckToken,
} from '@/lib/sidecar/app-check-mint';

describe('app-check-mint', () => {
  beforeEach(() => {
    _resetAppCheckMintCacheForTest();
    mockCreateToken.mockReset();
    mockGetAppCheck.mockClear();
    mockGetApp.mockClear();
  });

  it('mints a token on first call via firebase-admin appCheck().createToken()', async () => {
    mockCreateToken.mockResolvedValue({
      token: 'minted-token-1',
      ttlMillis: 60 * 60 * 1000,
    });

    const result = await mintServerAppCheckToken();

    expect(result).toEqual({ token: 'minted-token-1' });
    expect(mockCreateToken).toHaveBeenCalledTimes(1);
    const firstCallArgs = mockCreateToken.mock.calls[0];
    expect(typeof firstCallArgs[0]).toBe('string');
    expect((firstCallArgs[0] as string).length).toBeGreaterThan(0);
  });

  it('returns the cached token on subsequent calls (cache hit)', async () => {
    mockCreateToken.mockResolvedValue({
      token: 'cached-token',
      ttlMillis: 60 * 60 * 1000,
    });

    const a = await mintServerAppCheckToken();
    const b = await mintServerAppCheckToken();
    const c = await mintServerAppCheckToken();

    expect(a.token).toBe('cached-token');
    expect(b.token).toBe('cached-token');
    expect(c.token).toBe('cached-token');
    expect(mockCreateToken).toHaveBeenCalledTimes(1);
  });

  it('refreshes the cache when the token enters the 10-minute buffer', async () => {
    // First mint returns a token whose TTL puts it inside the refresh
    // buffer (5 minutes). Next call must re-mint.
    mockCreateToken
      .mockResolvedValueOnce({ token: 'about-to-expire', ttlMillis: 5 * 60 * 1000 })
      .mockResolvedValueOnce({ token: 'fresh-token', ttlMillis: 60 * 60 * 1000 });

    const a = await mintServerAppCheckToken();
    const b = await mintServerAppCheckToken();

    expect(a.token).toBe('about-to-expire');
    expect(b.token).toBe('fresh-token');
    expect(mockCreateToken).toHaveBeenCalledTimes(2);
  });

  it('throws AppCheckMintError when createToken fails', async () => {
    mockCreateToken.mockRejectedValue(new Error('IAM denied: tokens.create'));

    await expect(mintServerAppCheckToken()).rejects.toBeInstanceOf(AppCheckMintError);
    // Cache stays empty after failure so a retry will re-attempt.
    mockCreateToken.mockResolvedValueOnce({
      token: 'recovered',
      ttlMillis: 60 * 60 * 1000,
    });
    const retried = await mintServerAppCheckToken();
    expect(retried.token).toBe('recovered');
  });

  it('getServerAppCheckTokenOrNull returns null on mint failure', async () => {
    mockCreateToken.mockRejectedValue(new Error('boom'));
    const token = await getServerAppCheckTokenOrNull();
    expect(token).toBeNull();
  });

  it('getServerAppCheckTokenOrNull returns the token on success', async () => {
    mockCreateToken.mockResolvedValue({
      token: 'happy-path-token',
      ttlMillis: 60 * 60 * 1000,
    });
    const token = await getServerAppCheckTokenOrNull();
    expect(token).toBe('happy-path-token');
  });
});
