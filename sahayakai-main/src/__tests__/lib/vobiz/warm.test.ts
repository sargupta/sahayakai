import { warmTelephony, WARM_PATH } from '@/lib/vobiz/warm';

describe('warmTelephony', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('pings the telephony sidecar readiness path', () => {
    process.env.VOBIZ_STREAM_BASE_URL = 'https://telephony.example.run.app/';
    const fetchImpl = jest.fn().mockResolvedValue(new Response('ok'));
    warmTelephony(fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith(`https://telephony.example.run.app${WARM_PATH}`, expect.objectContaining({ method: 'GET' }));
  });

  it('is a no-op when no sidecar URL is configured', () => {
    delete process.env.VOBIZ_STREAM_BASE_URL;
    delete process.env.NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL;
    const fetchImpl = jest.fn();
    warmTelephony(fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('never throws or rejects, so warming can never break dialling', async () => {
    process.env.VOBIZ_STREAM_BASE_URL = 'https://telephony.example.run.app';
    const rejecting = jest.fn().mockRejectedValue(new Error('cold'));
    const throwing = jest.fn(() => {
      throw new Error('sync');
    });
    expect(() => warmTelephony(rejecting as unknown as typeof fetch)).not.toThrow();
    expect(() => warmTelephony(throwing as unknown as typeof fetch)).not.toThrow();
    await new Promise((r) => setImmediate(r));
  });
});
