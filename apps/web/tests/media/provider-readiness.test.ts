import { describe, expect, it } from 'vitest';

import {
  labelConfiguredVolcengineModel,
  readyMediaModels,
  volcengineModelMatchesSurface,
  withConfiguredMediaModels,
} from '../../src/media/provider-readiness';
import { IMAGE_MODELS, VIDEO_MODELS } from '../../src/media/models';
import type { MediaProviderCredentials } from '../../src/types';

const configuredVolcengine: MediaProviderCredentials = {
  apiKey: '',
  apiKeyConfigured: true,
  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  imageModel: 'doubao-seedream-5-0-pro-260628',
};

describe('Home media provider readiness', () => {
  it('keeps credential-free Cloud routes plus configured provider routes', () => {
    const ready = readyMediaModels(IMAGE_MODELS, {
      volcengine: configuredVolcengine,
    });

    expect(new Set(ready.map((model) => model.provider))).toEqual(
      new Set(['vela', 'volcengine']),
    );
    expect(ready.map((model) => model.id)).toContain('doubao-seedream-3-0-t2i-250415');
    expect(ready.map((model) => model.id)).not.toContain('gpt-image-2');
  });

  it('labels the Volcengine image route with its configured Seedream wire model', () => {
    const labeled = labelConfiguredVolcengineModel(
      readyMediaModels(IMAGE_MODELS, { volcengine: configuredVolcengine }),
      'image',
      { volcengine: configuredVolcengine },
    );

    expect(labeled.find((model) => model.id === 'doubao-seedream-3-0-t2i-250415'))
      .toMatchObject({
        label: 'doubao-seedream-5-0-pro-260628 (configured)',
        provider: 'volcengine',
      });
  });

  it('does not relabel a Seedance route with an image-only override', () => {
    const ready = readyMediaModels(VIDEO_MODELS, { volcengine: configuredVolcengine });
    const labeled = labelConfiguredVolcengineModel(
      ready,
      'video',
      { volcengine: configuredVolcengine },
    );

    expect(labeled).toEqual(ready);
    expect(labeled.find((model) => model.id === 'doubao-seedance-2-0-260128')?.label)
      .toBe('seedance-2.0');
  });

  it('adds provider-scoped configured models that are absent from the static registry', () => {
    const models = withConfiguredMediaModels(
      readyMediaModels(VIDEO_MODELS, {
        dashscope: {
          apiKey: '',
          apiKeyConfigured: true,
          baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
          videoModel: 'wan3.0-video-prime',
        },
      }),
      'video',
      {
        dashscope: {
          apiKey: '',
          apiKeyConfigured: true,
          baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
          videoModel: 'wan3.0-video-prime',
        },
      },
    );

    expect(models).toContainEqual(expect.objectContaining({
      id: 'configured-media:dashscope:video:wan3.0-video-prime',
      label: 'wan3.0-video-prime (DashScope · configured)',
      provider: 'dashscope',
    }));
  });

  it('does not expose a legacy Volcengine image model as a TTS model', () => {
    const models = withConfiguredMediaModels([], 'tts', {
      volcengine: {
        apiKey: '',
        apiKeyConfigured: true,
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        model: 'doubao-seedream-5-0-pro-260628',
      },
    });

    expect(models).toEqual([]);
  });
});

describe('Volcengine custom model surface matching', () => {
  it('separates Seedream image ids from Seedance video ids', () => {
    expect(volcengineModelMatchesSurface('doubao-seedream-5-0-pro-260628', 'image')).toBe(true);
    expect(volcengineModelMatchesSurface('doubao-seedream-5-0-pro-260628', 'video')).toBe(false);
    expect(volcengineModelMatchesSurface('doubao-seedance-2-0-260128', 'video')).toBe(true);
    expect(volcengineModelMatchesSurface('doubao-seedance-2-0-260128', 'image')).toBe(false);
  });
});
