import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  dashScopeCompatibleBaseUrl,
  dashScopeNativeBaseUrl,
  renderDashScopeImage,
  renderDashScopeSpeech,
  type DashScopeMediaContext,
} from '../../src/media/dashscope.js';

const IMAGE_BYTES = Buffer.from('dashscope-image');
const AUDIO_BYTES = Buffer.from('dashscope-audio');

function context(patch: Partial<DashScopeMediaContext> = {}): DashScopeMediaContext {
  return {
    wireModel: 'qwen-image-3.0',
    prompt: '一只戴着红色围巾的小猫',
    aspect: '16:9',
    resolution: undefined,
    length: undefined,
    voice: '',
    language: '',
    imageRef: null,
    imageRefs: [],
    requestInit: {},
    ...patch,
  };
}

describe('DashScope native media adapter', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.unstubAllGlobals();
  });

  it('keeps native media and compatible chat base URLs independent', () => {
    expect(dashScopeNativeBaseUrl('https://dashscope.aliyuncs.com/compatible-mode/v1'))
      .toBe('https://dashscope.aliyuncs.com/api/v1');
    expect(dashScopeCompatibleBaseUrl('https://dashscope.aliyuncs.com/api/v1'))
      .toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');
  });

  it('sends Qwen text-to-image through the native multimodal endpoint', async () => {
    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/services/aigc/multimodal-generation/generation')) {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          authorization: 'Bearer dashscope-key',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init?.body))).toEqual({
          model: 'qwen-image-3.0',
          input: {
            messages: [{
              role: 'user',
              content: [{ text: '一只戴着红色围巾的小猫' }],
            }],
          },
          parameters: {
            prompt_extend: true,
            size: '1664*928',
          },
        });
        return new Response(JSON.stringify({
          output: {
            choices: [{ message: { content: [{ image: 'https://93.184.216.34/qwen.png' }] } }],
          },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      expect(url).toBe('https://93.184.216.34/qwen.png');
      return new Response(IMAGE_BYTES, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await renderDashScopeImage(context(), {
      apiKey: 'dashscope-key',
      baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    });

    expect(result.bytes).toEqual(IMAGE_BYTES);
    expect(result.providerNote).toContain('dashscope/qwen-image-3.0');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('places reference images before the edit prompt', async () => {
    const reference = { dataUrl: 'data:image/png;base64,aW1hZ2U=' };
    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      if (String(input).endsWith('/services/aigc/multimodal-generation/generation')) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          input: {
            messages: [{
              role: 'user',
              content: [
                { image: reference.dataUrl },
                { text: '把围巾改成蓝色' },
              ],
            }],
          },
        });
        return new Response(JSON.stringify({
          output: {
            choices: [{ message: { content: [{ image: 'https://93.184.216.34/edited.png' }] } }],
          },
        }), { status: 200 });
      }
      return new Response(IMAGE_BYTES, { status: 200, headers: { 'content-type': 'image/png' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await renderDashScopeImage(context({
      prompt: '把围巾改成蓝色',
      imageRef: reference,
      imageRefs: [reference],
    }), {
      apiKey: 'dashscope-key',
      baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    });

    expect(result.providerNote).toContain('image edit');
  });

  it('uses a safe default voice for Qwen TTS and downloads output.audio.url', async () => {
    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/services/aigc/multimodal-generation/generation')) {
        expect(JSON.parse(String(init?.body))).toEqual({
          model: 'qwen3-tts-instruct-flash',
          input: {
            text: '喵喵',
            voice: 'Cherry',
          },
        });
        return new Response(JSON.stringify({
          output: { audio: { url: 'https://93.184.216.34/meow.wav' } },
        }), { status: 200 });
      }
      expect(url).toBe('https://93.184.216.34/meow.wav');
      return new Response(AUDIO_BYTES, {
        status: 200,
        headers: { 'content-type': 'audio/wav' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await renderDashScopeSpeech(context({
      wireModel: 'qwen3-tts-instruct-flash',
      prompt: '喵喵',
    }), {
      apiKey: 'dashscope-key',
      baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    });

    expect(result.bytes).toEqual(AUDIO_BYTES);
    expect(result.suggestedExt).toBe('.wav');
    expect(result.providerNote).toContain('Cherry');
  });

  it('creates and uses a designed voice for Qwen3 TTS VD models', async () => {
    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      if (url.endsWith('/services/audio/tts/customization')) {
        if (body?.input?.action === 'list') {
          return new Response(JSON.stringify({
            output: {
              page_index: 0,
              page_size: 100,
              total_count: 0,
              voice_list: [],
            },
          }), { status: 200 });
        }
        expect(body).toEqual({
          model: 'qwen-voice-design',
          input: {
            action: 'create',
            target_model: 'qwen3-tts-vd-2026-01-26',
            preferred_name: expect.stringMatching(/^od_[a-f0-9]{12}$/),
            voice_prompt: '软糯奶音的年轻女声，语速缓慢，尾音轻柔上扬',
            preview_text: '喵，喵喵，喵呜。',
            language: 'zh',
          },
          parameters: {
            sample_rate: 24000,
            response_format: 'wav',
          },
        });
        return new Response(JSON.stringify({
          output: { voice: 'od_kitten_voice' },
        }), { status: 200 });
      }
      if (url.endsWith('/services/aigc/multimodal-generation/generation')) {
        expect(body).toEqual({
          model: 'qwen3-tts-vd-2026-01-26',
          input: {
            text: '喵，喵喵，喵呜。',
            voice: 'od_kitten_voice',
            language_type: 'Chinese',
          },
        });
        return new Response(JSON.stringify({
          output: { audio: { url: 'https://93.184.216.34/designed-meow.wav' } },
        }), { status: 200 });
      }
      expect(url).toBe('https://93.184.216.34/designed-meow.wav');
      return new Response(AUDIO_BYTES, {
        status: 200,
        headers: { 'content-type': 'audio/wav' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await renderDashScopeSpeech(context({
      wireModel: 'qwen3-tts-vd-2026-01-26',
      prompt: '喵，喵喵，喵呜。',
      voice: '软糯奶音的年轻女声，语速缓慢，尾音轻柔上扬',
      language: 'Chinese',
    }), {
      apiKey: 'dashscope-key',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });

    expect(result.bytes).toEqual(AUDIO_BYTES);
    expect(result.suggestedExt).toBe('.wav');
    expect(result.providerNote).toContain('od_kitten_voice');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('preserves DashScope status and response body in provider errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ code: 'Throttling', message: 'rate limit exceeded' }),
      { status: 429 },
    )));

    await expect(renderDashScopeImage(context(), {
      apiKey: 'dashscope-key',
      baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    })).rejects.toThrow(/dashscope image generation 429:.*Throttling.*rate limit exceeded/);
  });
});
