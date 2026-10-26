import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchMediaProviderCatalog } from '../../src/media/provider-model-catalog';

describe('fetchMediaProviderCatalog', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.unstubAllGlobals();
  });

  it('posts the provider and requested media type to the daemon', async () => {
    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      expect(String(input)).toBe('/api/media/providers/models');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({
        providerId: 'volcengine',
        type: 'stt',
        apiKey: 'ark-key',
        baseUrl: 'https://ark.example.test/api/v3',
      });
      return new Response(JSON.stringify({
        ok: true,
        type: 'stt',
        models: [{ id: 'asr-custom', label: 'ASR Custom' }],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchMediaProviderCatalog({
      providerId: 'volcengine',
      type: 'stt',
      apiKey: 'ark-key',
      baseUrl: 'https://ark.example.test/api/v3',
    })).resolves.toEqual({
      ok: true,
      type: 'stt',
      models: [{ id: 'asr-custom', label: 'ASR Custom' }],
    });
  });
});
