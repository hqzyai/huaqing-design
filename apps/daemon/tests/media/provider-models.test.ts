import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  listMediaProviderModels,
  parseMediaProviderModels,
} from '../../src/media/provider-models.js';

describe('media provider model discovery', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.unstubAllGlobals();
  });

  it('classifies explicit provider types and common model-id families', () => {
    const payload = {
      data: [
        { id: 'image-deployment', types: 'image_generation,llm' },
        { id: 'seedance-video-deployment', type: 'video' },
        { id: 'whisper-1' },
        { model_id: 'speech-1.6', model_name: 'Fish Speech' },
        { id: 'chat-only', types: 'llm' },
      ],
    };

    expect(parseMediaProviderModels(payload, 'image')).toEqual([
      { id: 'image-deployment', label: 'image-deployment' },
    ]);
    expect(parseMediaProviderModels(payload, 'video')).toEqual([
      { id: 'seedance-video-deployment', label: 'seedance-video-deployment' },
    ]);
    expect(parseMediaProviderModels(payload, 'stt')).toEqual([
      { id: 'whisper-1', label: 'whisper-1' },
    ]);
    expect(parseMediaProviderModels(payload, 'tts')).toEqual([
      { id: 'speech-1.6', label: 'Fish Speech' },
    ]);
  });

  it('calls the provider models endpoint and returns only the requested type', async () => {
    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      expect(String(input)).toBe('https://ark.example.test/api/v3/models');
      expect(init?.headers).toMatchObject({ authorization: 'Bearer ark-key' });
      return new Response(JSON.stringify({
        data: [
          { id: 'doubao-seedream-custom', type: 'image_generation' },
          { id: 'doubao-seedance-custom', type: 'video' },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(listMediaProviderModels({
      providerId: 'volcengine',
      type: 'video',
      apiKey: 'ark-key',
      baseUrl: 'https://ark.example.test/api/v3',
    })).resolves.toEqual({
      ok: true,
      type: 'video',
      models: [{ id: 'doubao-seedance-custom', label: 'doubao-seedance-custom' }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('adds provider-scoped Wan3.0 fallbacks omitted by DashScope /models', async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      expect(String(input)).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/models');
      return new Response(JSON.stringify({
        data: [
          { id: 'qwen3.8-flash' },
          { id: 'wan2.7-image' },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await listMediaProviderModels({
      providerId: 'dashscope',
      type: 'video',
      apiKey: 'dashscope-key',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });

    expect(result.models).toEqual([
      { id: 'wan3.0-video-prime', label: 'wan3.0-video-prime' },
      { id: 'wan3.0-video', label: 'wan3.0-video' },
    ]);
  });

  it('returns DashScope native model fallbacks when its compatible catalogue is unavailable', async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      expect(String(input)).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/models');
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(listMediaProviderModels({
      providerId: 'dashscope',
      type: 'tts',
      apiKey: 'dashscope-key',
      baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    })).resolves.toMatchObject({
      ok: true,
      type: 'tts',
      models: [
        { id: 'qwen3-tts-instruct-flash', label: 'qwen3-tts-instruct-flash' },
        { id: 'qwen3-tts-flash', label: 'qwen3-tts-flash' },
      ],
    });
  });

  it('falls back from /models to a singular /model endpoint on 404', async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      if (String(input).endsWith('/models')) return new Response('', { status: 404 });
      expect(String(input)).toBe('https://speech.example.test/v1/model');
      return new Response(JSON.stringify([
        { model_id: 'scribe_v1', capabilities: ['speech-to-text'] },
      ]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await listMediaProviderModels({
      providerId: 'elevenlabs',
      type: 'stt',
      apiKey: 'eleven-key',
      baseUrl: 'https://speech.example.test',
    });

    expect(result.models).toEqual([{ id: 'scribe_v1', label: 'scribe_v1' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not duplicate Google API version paths when the base URL is versioned', async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      expect(String(input)).toBe('https://generativelanguage.googleapis.com/v1beta/models');
      return new Response(JSON.stringify({
        models: [{ name: 'models/imagen-4.0-generate-001' }],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await listMediaProviderModels({
      providerId: 'nanobanana',
      type: 'image',
      apiKey: 'google-key',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    });

    expect(result.models).toEqual([{
      id: 'imagen-4.0-generate-001',
      label: 'imagen-4.0-generate-001',
    }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
