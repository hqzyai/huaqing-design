import type {
  MediaProviderCatalogOption,
  MediaProviderCatalogResponse,
  MediaProviderCatalogType,
} from '@open-design/contracts';
import {
  redactSecrets,
  validateUserProviderBaseUrl,
} from '../connectionTest.js';
import {
  aihubmixCatalogUrl,
  aihubmixHeaders,
} from '../integrations/aihubmix.js';
import { dashScopeCompatibleBaseUrl } from './dashscope.js';

type JsonRecord = Record<string, unknown>;

// DashScope's compatible `/models` catalogue does not consistently include
// native multimodal models. These provider-scoped fallbacks keep all four
// Settings selectors useful even when that endpoint returns 404 or omits a
// family. They are never attached to the OpenAI provider.
const DASHSCOPE_MODEL_FALLBACKS: Record<MediaProviderCatalogType, MediaProviderCatalogOption[]> = {
  image: [
    { id: 'qwen-image-3.0', label: 'qwen-image-3.0' },
    { id: 'qwen-image-3.0-pro', label: 'qwen-image-3.0-pro' },
  ],
  video: [
    { id: 'wan3.0-video-prime', label: 'wan3.0-video-prime' },
    { id: 'wan3.0-video', label: 'wan3.0-video' },
  ],
  stt: [
    { id: 'qwen3-asr-flash-2026-02-10', label: 'qwen3-asr-flash-2026-02-10' },
  ],
  tts: [
    { id: 'qwen3-tts-instruct-flash', label: 'qwen3-tts-instruct-flash' },
    { id: 'qwen3-tts-flash', label: 'qwen3-tts-flash' },
  ],
};

export interface ListMediaProviderModelsInput {
  providerId: string;
  type: MediaProviderCatalogType;
  apiKey: string;
  baseUrl: string;
  requestInit?: Pick<RequestInit, 'dispatcher'>;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function catalogRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!isRecord(data)) return [];
  for (const key of ['data', 'models', 'items', 'results']) {
    const value = data[key];
    if (Array.isArray(value)) return value;
    if (isRecord(value)) {
      for (const nestedKey of ['data', 'models', 'items', 'results']) {
        const nested = value[nestedKey];
        if (Array.isArray(nested)) return nested;
      }
    }
  }
  return [];
}

function rowId(row: JsonRecord): string {
  for (const key of ['id', 'model_id', 'modelId', 'name']) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim().replace(/^models\//, '');
    }
  }
  return '';
}

function rowLabel(row: JsonRecord, id: string): string {
  for (const key of ['label', 'model_name', 'display_name', 'displayName', 'name']) {
    const value = row[key];
    if (typeof value === 'string' && value.trim() && value.trim() !== `models/${id}`) {
      return value.trim();
    }
  }
  return id;
}

function normalizedTypeTokens(row: JsonRecord): string[] {
  const rawValues = [
    row.types,
    row.type,
    row.model_type,
    row.modelType,
    row.capabilities,
    row.capability,
    row.modalities,
  ];
  const tokens: string[] = [];
  for (const raw of rawValues) {
    const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
    for (const value of values) {
      if (typeof value !== 'string') continue;
      const token = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
      if (token) tokens.push(token);
    }
  }
  if (row.can_do_text_to_speech === true || row.canDoTextToSpeech === true) tokens.push('tts');
  if (row.can_do_speech_to_text === true || row.canDoSpeechToText === true) tokens.push('stt');
  return tokens;
}

function recognizedTypes(row: JsonRecord, id: string): Set<MediaProviderCatalogType> {
  const types = new Set<MediaProviderCatalogType>();
  const tokens = normalizedTypeTokens(row);
  for (const token of tokens) {
    if (/^(?:image|images|image_generation|text_to_image|t2i|i2i)$/.test(token)) types.add('image');
    if (/^(?:video|videos|video_generation|text_to_video|image_to_video|t2v|i2v|v2v)$/.test(token)) types.add('video');
    if (/^(?:stt|asr|speech_to_text|speech_recognition|transcription|transcribe)$/.test(token)) types.add('stt');
    if (/^(?:tts|text_to_speech|speech_synthesis|voice_synthesis)$/.test(token)) types.add('tts');
  }
  if (types.size > 0) return types;

  const normalized = id.toLowerCase();
  if (/image|imagen|dall[-_.]?e|seedream|seededit|flux|recraft|ideogram|sdxl|stable[-_.]?diffusion|t2i|i2i/.test(normalized)) {
    types.add('image');
  }
  if (/video|seedance|veo|kling|hailuo|t2v|i2v|v2v|(?:^|[/_.-])wan(?:[/_.-]|$)/.test(normalized)) {
    types.add('video');
  }
  if (/whisper|transcrib|speech[-_.]?to[-_.]?text|speech[-_.]?recognition|(?:^|[/_.-])(?:stt|asr|scribe)(?:[/_.-]|$)/.test(normalized)) {
    types.add('stt');
  }
  if (/text[-_.]?to[-_.]?speech|speech[-_.]?synth|(?:^|[/_.-])tts(?:[/_.-]|$)|(?:^|[/_.-])speech[-_.]?\d/.test(normalized)) {
    types.add('tts');
  }
  return types;
}

export function parseMediaProviderModels(
  data: unknown,
  type: MediaProviderCatalogType,
): MediaProviderCatalogOption[] {
  const seen = new Set<string>();
  const models: MediaProviderCatalogOption[] = [];
  for (const rawRow of catalogRows(data)) {
    if (!isRecord(rawRow)) continue;
    const id = rowId(rawRow);
    if (!id || seen.has(id) || !recognizedTypes(rawRow, id).has(type)) continue;
    seen.add(id);
    models.push({ id, label: rowLabel(rawRow, id) });
  }
  return models;
}

function mergeCatalogOptions(
  discovered: MediaProviderCatalogOption[],
  fallback: MediaProviderCatalogOption[],
): MediaProviderCatalogOption[] {
  const merged = new Map<string, MediaProviderCatalogOption>();
  for (const option of discovered) merged.set(option.id, option);
  for (const option of fallback) {
    if (!merged.has(option.id)) merged.set(option.id, option);
  }
  return Array.from(merged.values());
}

function providerCatalogFallbacks(
  input: ListMediaProviderModelsInput,
): MediaProviderCatalogOption[] {
  if (input.providerId === 'dashscope') return DASHSCOPE_MODEL_FALLBACKS[input.type];
  return [];
}

function appendCatalogPath(baseUrl: string, suffix: '/models' | '/model'): string {
  const url = new URL(baseUrl);
  const pathname = url.pathname.replace(/\/+$/, '');
  if (/\/models?$/.test(pathname)) return url.toString();
  url.pathname = /\/v\d+(?:beta\d*)?(?:\/|$)/.test(pathname)
    ? `${pathname}${suffix}`
    : `${pathname}/v1${suffix}`;
  return url.toString();
}

function catalogUrls(input: ListMediaProviderModelsInput): string[] {
  if (input.providerId === 'dashscope') {
    return [`${dashScopeCompatibleBaseUrl(input.baseUrl)}/models`];
  }
  if (input.providerId === 'aihubmix') {
    const type = input.type === 'image' ? 'image_generation' : input.type;
    return [aihubmixCatalogUrl(input.baseUrl, type)];
  }
  if (input.providerId === 'nanobanana' || input.providerId === 'google') {
    const url = new URL(input.baseUrl);
    const pathname = url.pathname.replace(/\/+$/, '');
    if (/\/models?$/.test(pathname)) return [url.toString()];
    url.pathname = /\/v\d+(?:beta\d*)?$/.test(pathname)
      ? `${pathname}/models`
      : `${pathname}/v1beta/models`;
    return [url.toString()];
  }
  return [
    appendCatalogPath(input.baseUrl, '/models'),
    appendCatalogPath(input.baseUrl, '/model'),
  ];
}

function catalogHeaders(input: ListMediaProviderModelsInput): Record<string, string> {
  if (!input.apiKey.trim()) return {};
  if (input.providerId === 'aihubmix') return aihubmixHeaders(input.apiKey);
  if (input.providerId === 'elevenlabs') return { 'xi-api-key': input.apiKey };
  if (input.providerId === 'nanobanana' || input.providerId === 'google') {
    return { 'x-goog-api-key': input.apiKey };
  }
  return { authorization: `Bearer ${input.apiKey}` };
}

export async function listMediaProviderModels(
  input: ListMediaProviderModelsInput,
): Promise<MediaProviderCatalogResponse> {
  const validated = await validateUserProviderBaseUrl(input.baseUrl);
  if (validated.error || !validated.parsed) {
    return {
      ok: false,
      type: input.type,
      models: [],
      detail: validated.error || 'Invalid provider base URL',
      status: validated.forbidden ? 403 : 400,
    };
  }

  const urls = catalogUrls(input);
  let lastStatus = 0;
  let lastDetail = '';
  for (let index = 0; index < urls.length; index += 1) {
    const response = await fetch(urls[index]!, {
      method: 'GET',
      headers: catalogHeaders(input),
      ...input.requestInit,
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    }).catch((error: unknown) => {
      lastDetail = error instanceof Error ? error.message : String(error);
      return null;
    });
    if (!response) continue;
    lastStatus = response.status;
    const text = await response.text();
    if (!response.ok) {
      lastDetail = text.slice(0, 240) || `provider catalog ${response.status}`;
      if (response.status === 404 && index + 1 < urls.length) continue;
      break;
    }
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return {
        ok: false,
        type: input.type,
        models: [],
        status: response.status,
        detail: 'Provider model catalog returned invalid JSON',
      };
    }
    return {
      ok: true,
      type: input.type,
      models: mergeCatalogOptions(
        parseMediaProviderModels(data, input.type),
        providerCatalogFallbacks(input),
      ),
    };
  }

  const fallback = providerCatalogFallbacks(input);
  if (fallback.length > 0) {
    return {
      ok: true,
      type: input.type,
      models: fallback,
      ...(lastDetail ? { detail: redactSecrets(lastDetail, [input.apiKey]) } : {}),
    };
  }

  return {
    ok: false,
    type: input.type,
    models: [],
    ...(lastStatus ? { status: lastStatus } : {}),
    detail: redactSecrets(lastDetail || 'Could not fetch provider model catalog', [input.apiKey]),
  };
}
