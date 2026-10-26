import { describe, expect, it } from 'vitest';

import {
  buildHomeMediaComposer,
  metadataForHomeMediaComposer,
} from '../src/components/home-hero/media-surfaces';
import type { MediaModel } from '../src/media/models';

describe('Home image composer metadata', () => {
  it('persists the default Vela model into project metadata', () => {
    const composer = buildHomeMediaComposer('image', []);

    expect(metadataForHomeMediaComposer('image', composer.inputs, [])).toEqual({
      kind: 'image',
      imageModel: 'vela/gpt-image-2',
    });
  });

  it('preserves an explicitly selected OpenAI BYOK model', () => {
    const composer = buildHomeMediaComposer('image', [], { model: 'gpt-image-2' });

    expect(metadataForHomeMediaComposer('image', composer.inputs, [])).toEqual({
      kind: 'image',
      imageModel: 'gpt-image-2',
    });
  });

  it('falls back to the first image route that is available to the composer', () => {
    const imageModels: MediaModel[] = [{
      id: 'doubao-seedream-3-0-t2i-250415',
      label: 'seedream configured route',
      hint: 'Volcengine Ark',
      provider: 'volcengine',
      caps: ['t2i'],
    }];
    const composer = buildHomeMediaComposer('image', [], {}, [], { imageModels });

    expect(composer.inputs.model).toBe('doubao-seedream-3-0-t2i-250415');
  });
});

describe('Home video composer metadata', () => {
  it('persists the selected video model into project metadata', () => {
    const composer = buildHomeMediaComposer('video', [], {
      model: 'doubao-seedance-2-0-fast-260128',
    });

    expect(metadataForHomeMediaComposer('video', composer.inputs, [])).toEqual({
      kind: 'video',
      videoModel: 'doubao-seedance-2-0-fast-260128',
    });
  });

  it('falls back to the first non-HyperFrames video route that is available', () => {
    const videoModels: MediaModel[] = [
      {
        id: 'hyperframes-html',
        label: 'HyperFrames',
        hint: 'local',
        provider: 'hyperframes',
        caps: ['t2v'],
      },
      {
        id: 'doubao-seedance-2-0-260128',
        label: 'seedance-2.0',
        hint: 'Volcengine Ark',
        provider: 'volcengine',
        caps: ['t2v'],
      },
    ];
    const composer = buildHomeMediaComposer('video', [], {}, [], { videoModels });

    expect(composer.inputs.model).toBe('doubao-seedance-2-0-260128');
    expect(metadataForHomeMediaComposer('video', composer.inputs, [])).toEqual({
      kind: 'video',
      videoModel: 'doubao-seedance-2-0-260128',
    });
  });
});

describe('Home audio composer metadata', () => {
  it('persists the selected TTS model and speech kind', () => {
    const configuredTts: MediaModel = {
      id: 'configured-media:dashscope:tts:qwen3-tts-flash',
      label: 'qwen3-tts-flash (DashScope · configured)',
      hint: 'DashScope · configured in Settings',
      provider: 'dashscope',
      caps: ['tts'],
    };
    const composer = buildHomeMediaComposer(
      'audio',
      [],
      { model: configuredTts.id },
      [],
      { audioModelsByKind: { speech: [configuredTts] } },
    );

    expect(metadataForHomeMediaComposer('audio', composer.inputs, [])).toEqual({
      kind: 'audio',
      audioKind: 'speech',
      audioModel: configuredTts.id,
    });
  });
});
