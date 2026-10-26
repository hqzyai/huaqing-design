import { describe, expect, it } from 'vitest';

import {
  resolveProviderModelForPurpose,
  resolveVolcengineWireModel,
} from '../../src/media/index.js';

describe('provider wire model resolution', () => {
  it('keeps image and video overrides independent', () => {
    const config = {
      model: 'legacy-model',
      imageModel: 'custom-image-deployment',
      videoModel: 'custom-video-deployment',
    };
    expect(resolveProviderModelForPurpose(config, 'image', 'volcengine'))
      .toBe('custom-image-deployment');
    expect(resolveProviderModelForPurpose(config, 'video', 'volcengine'))
      .toBe('custom-video-deployment');
  });

  it('keeps STT and TTS overrides independent', () => {
    const config = {
      sttModel: 'whisper-custom',
      ttsModel: 'speech-custom',
    };
    expect(resolveProviderModelForPurpose(config, 'stt', 'openai')).toBe('whisper-custom');
    expect(resolveProviderModelForPurpose(config, 'tts', 'openai')).toBe('speech-custom');
  });

  it('uses the legacy catch-all model for providers without a scoped value', () => {
    expect(resolveProviderModelForPurpose({ model: 'legacy-model' }, 'image', 'openai'))
      .toBe('legacy-model');
  });

  it('does not leak a legacy Volcengine image model into video', () => {
    const config = { model: 'doubao-seedream-5-0-pro-260628' };
    expect(resolveProviderModelForPurpose(config, 'image', 'volcengine'))
      .toBe('doubao-seedream-5-0-pro-260628');
    expect(resolveProviderModelForPurpose(config, 'video', 'volcengine')).toBeUndefined();
    expect(resolveProviderModelForPurpose(config, 'tts', 'volcengine')).toBeUndefined();
    expect(resolveProviderModelForPurpose(config, 'stt', 'volcengine')).toBeUndefined();
  });

  it('accepts an arbitrary scoped deployment id after request scoping', () => {
    expect(resolveVolcengineWireModel('image', 'seedream-selected', 'deployment-123'))
      .toBe('deployment-123');
    expect(resolveVolcengineWireModel('image', 'seedream-selected', '  '))
      .toBe('seedream-selected');
  });
});
