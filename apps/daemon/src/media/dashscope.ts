import type { MediaProviderConfigEntry } from '@open-design/contracts';
import { createHash } from 'node:crypto';
import { assertAndFetchExternalAsset } from '../connectionTest.js';

type MediaRequestInit = Pick<RequestInit, 'dispatcher'>;

export type DashScopeImageRef = {
  dataUrl: string;
};

export type DashScopeMediaContext = {
  wireModel: string;
  prompt: string;
  aspect: string | undefined;
  resolution: string | undefined;
  length: number | undefined;
  voice: string;
  language: string;
  imageRef: DashScopeImageRef | null;
  imageRefs: DashScopeImageRef[];
  requestInit: MediaRequestInit;
};

export type DashScopeRenderResult = {
  bytes: Buffer;
  providerNote: string;
  suggestedExt?: string;
};

type JsonRecord = Record<string, unknown>;
type ProgressFn = (message: string) => void;

export const DASHSCOPE_NATIVE_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1';
export const DASHSCOPE_CHAT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function truncate(value: unknown, length: number): string {
  const text = typeof value === 'string' ? value : String(value ?? '');
  return text.length <= length ? text : `${text.slice(0, length)}…`;
}

function requestInit(
  ctx: Pick<DashScopeMediaContext, 'requestInit'>,
  init: RequestInit = {},
): RequestInit {
  return {
    ...ctx.requestInit,
    ...init,
  };
}

/**
 * DashScope exposes chat through `/compatible-mode/v1`, while image, video,
 * and TTS use its native `/api/v1` services. Accept either saved form and
 * normalize it here so the DashScope adapter never depends on OpenAI URL
 * builders.
 */
export function dashScopeNativeBaseUrl(rawBase?: string): string {
  const raw = (rawBase || DASHSCOPE_NATIVE_BASE_URL).trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return raw.replace(/\/+$/, '');
  }
  const pathname = parsed.pathname.replace(/\/+$/, '');
  if (/\/compatible-mode\/v1$/i.test(pathname)) {
    parsed.pathname = pathname.replace(/\/compatible-mode\/v1$/i, '/api/v1');
  } else if (/\/api\/v1$/i.test(pathname)) {
    parsed.pathname = pathname;
  } else if (!pathname) {
    parsed.pathname = '/api/v1';
  } else {
    parsed.pathname = `${pathname}/api/v1`;
  }
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

export function dashScopeCompatibleBaseUrl(rawBase?: string): string {
  const raw = (rawBase || DASHSCOPE_CHAT_BASE_URL).trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return raw.replace(/\/+$/, '');
  }
  const pathname = parsed.pathname.replace(/\/+$/, '');
  if (/\/api\/v1$/i.test(pathname)) {
    parsed.pathname = pathname.replace(/\/api\/v1$/i, '/compatible-mode/v1');
  } else if (/\/compatible-mode\/v1$/i.test(pathname)) {
    parsed.pathname = pathname;
  } else if (!pathname) {
    parsed.pathname = '/compatible-mode/v1';
  } else {
    parsed.pathname = `${pathname}/compatible-mode/v1`;
  }
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

function wireModel(ctx: DashScopeMediaContext, credentials: MediaProviderConfigEntry): string {
  return (credentials.model || ctx.wireModel).trim();
}

function requireCredentials(credentials: MediaProviderConfigEntry): string {
  const apiKey = credentials.apiKey?.trim();
  if (!apiKey) {
    throw new Error('no DashScope API key — configure DashScope in Settings or set DASHSCOPE_API_KEY');
  }
  return apiKey;
}

async function parseJsonResponse(response: Response, operation: string): Promise<JsonRecord> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`dashscope ${operation} ${response.status}: ${truncate(text, 320)}`);
  }
  try {
    const parsed = text ? JSON.parse(text) : {};
    if (!isRecord(parsed)) throw new Error('response root is not an object');
    return parsed;
  } catch {
    throw new Error(`dashscope ${operation} returned invalid JSON: ${truncate(text, 240)}`);
  }
}

function imageSizeForAspect(aspect?: string): string {
  switch (aspect) {
    case '16:9': return '1664*928';
    case '9:16': return '928*1664';
    case '4:3': return '1472*1104';
    case '3:4': return '1104*1472';
    default: return '1328*1328';
  }
}

function contentRows(data: JsonRecord): unknown[] {
  const output = isRecord(data.output) ? data.output : null;
  const choices = Array.isArray(output?.choices) ? output.choices : [];
  const choice = isRecord(choices[0]) ? choices[0] : null;
  const message = isRecord(choice?.message) ? choice.message : null;
  return Array.isArray(message?.content) ? message.content : [];
}

function firstStringField(rows: unknown[], fields: string[]): string {
  for (const row of rows) {
    if (!isRecord(row)) continue;
    for (const field of fields) {
      const value = row[field];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return '';
}

function bytesFromDataUrl(value: string): Buffer | null {
  const match = /^data:[^;,]+;base64,(.+)$/s.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[1]!, 'base64');
  return bytes.length > 0 ? bytes : null;
}

async function downloadAsset(
  url: string,
  ctx: DashScopeMediaContext,
  operation: string,
): Promise<{ bytes: Buffer; contentType: string }> {
  const inline = bytesFromDataUrl(url);
  if (inline) return { bytes: inline, contentType: url.slice(5, url.indexOf(';')) };
  const response = await assertAndFetchExternalAsset(url, requestInit(ctx));
  if (!response.ok) {
    throw new Error(`dashscope ${operation} asset fetch ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error(`dashscope ${operation} returned zero bytes`);
  return {
    bytes,
    contentType: response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || '',
  };
}

export async function renderDashScopeImage(
  ctx: DashScopeMediaContext,
  credentials: MediaProviderConfigEntry,
): Promise<DashScopeRenderResult> {
  const apiKey = requireCredentials(credentials);
  const model = wireModel(ctx, credentials);
  const content: Array<Record<string, string>> = [];
  for (const image of ctx.imageRefs.length > 0
    ? ctx.imageRefs
    : ctx.imageRef
      ? [ctx.imageRef]
      : []) {
    content.push({ image: image.dataUrl });
  }
  content.push({ text: ctx.prompt || 'Generate a high-quality reference image.' });

  const response = await fetch(
    `${dashScopeNativeBaseUrl(credentials.baseUrl)}/services/aigc/multimodal-generation/generation`,
    requestInit(ctx, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: { messages: [{ role: 'user', content }] },
        parameters: {
          prompt_extend: true,
          size: imageSizeForAspect(ctx.aspect),
        },
      }),
    }),
  );
  const data = await parseJsonResponse(response, ctx.imageRef ? 'image edit' : 'image generation');
  const imageUrl = firstStringField(contentRows(data), ['image', 'url']);
  if (!imageUrl) throw new Error('dashscope image response missing output image URL');
  const { bytes } = await downloadAsset(imageUrl, ctx, 'image');
  return {
    bytes,
    providerNote: `dashscope/${model} · ${ctx.imageRef ? 'image edit' : 'text-to-image'} · ${ctx.aspect || '1:1'} · ${bytes.length} bytes`,
    suggestedExt: '.png',
  };
}

function audioExtension(contentType: string, url: string): string {
  if (contentType.includes('wav') || /\.wav(?:$|[?#])/i.test(url)) return '.wav';
  if (contentType.includes('flac') || /\.flac(?:$|[?#])/i.test(url)) return '.flac';
  if (contentType.includes('ogg') || contentType.includes('opus') || /\.(?:ogg|opus)(?:$|[?#])/i.test(url)) return '.ogg';
  if (contentType.includes('aac') || /\.aac(?:$|[?#])/i.test(url)) return '.aac';
  return '.mp3';
}

const QWEN_VOICE_DESIGN_MODEL_RE = /^qwen3-tts-vd(?:-|$)/i;
const DEFAULT_QWEN_VOICE_PROMPT =
  'A warm, natural, expressive voice with clear articulation, a gentle tone, and a moderate speaking pace.';

const DASHSCOPE_LANGUAGE_TYPES = new Map<string, string>([
  ['auto', 'Auto'],
  ['chinese', 'Chinese'],
  ['zh', 'Chinese'],
  ['zh-cn', 'Chinese'],
  ['english', 'English'],
  ['en', 'English'],
  ['german', 'German'],
  ['de', 'German'],
  ['italian', 'Italian'],
  ['it', 'Italian'],
  ['portuguese', 'Portuguese'],
  ['pt', 'Portuguese'],
  ['spanish', 'Spanish'],
  ['es', 'Spanish'],
  ['japanese', 'Japanese'],
  ['ja', 'Japanese'],
  ['korean', 'Korean'],
  ['ko', 'Korean'],
  ['french', 'French'],
  ['fr', 'French'],
  ['russian', 'Russian'],
  ['ru', 'Russian'],
]);

const VOICE_DESIGN_LANGUAGE_CODES = new Map<string, string>([
  ['Chinese', 'zh'],
  ['English', 'en'],
  ['German', 'de'],
  ['Italian', 'it'],
  ['Portuguese', 'pt'],
  ['Spanish', 'es'],
  ['Japanese', 'ja'],
  ['Korean', 'ko'],
  ['French', 'fr'],
  ['Russian', 'ru'],
]);

function dashScopeLanguageType(language: string): string | undefined {
  return DASHSCOPE_LANGUAGE_TYPES.get(language.trim().toLowerCase());
}

function voiceDesignLanguage(ctx: DashScopeMediaContext): string {
  const explicit = dashScopeLanguageType(ctx.language);
  if (explicit && explicit !== 'Auto') {
    return VOICE_DESIGN_LANGUAGE_CODES.get(explicit) || 'zh';
  }
  return /[\u3400-\u9fff]/u.test(ctx.prompt) ? 'zh' : 'en';
}

function isVoiceDescription(value: string): boolean {
  return value.length >= 16 || /[\s,，。;；]/u.test(value) || /[\u3400-\u9fff]/u.test(value);
}

function qwenVoicePrompt(requestedVoice: string): string {
  const prompt = isVoiceDescription(requestedVoice)
    ? requestedVoice
    : DEFAULT_QWEN_VOICE_PROMPT;
  return prompt.slice(0, 2048);
}

function qwenPreferredVoiceName(model: string, voicePrompt: string): string {
  const suffix = createHash('sha256')
    .update(`${model}\u0000${voicePrompt}`)
    .digest('hex')
    .slice(0, 12);
  return `od_${suffix}`;
}

function designedVoiceRows(data: JsonRecord): JsonRecord[] {
  const output = isRecord(data.output) ? data.output : null;
  return Array.isArray(output?.voice_list)
    ? output.voice_list.filter(isRecord)
    : [];
}

async function resolveQwenDesignedVoice(
  ctx: DashScopeMediaContext,
  apiKey: string,
  apiBase: string,
  model: string,
): Promise<string> {
  const requestedVoice = ctx.voice.trim();
  const voicePrompt = qwenVoicePrompt(requestedVoice);
  const endpoint = `${apiBase}/services/audio/tts/customization`;
  const headers = {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
  };
  const listResponse = await fetch(endpoint, requestInit(ctx, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'qwen-voice-design',
      input: {
        action: 'list',
        page_size: 100,
        page_index: 0,
      },
    }),
  }));
  const existing = designedVoiceRows(await parseJsonResponse(listResponse, 'voice design list'));
  const requestedMatch = requestedVoice
    ? existing.find((entry) => (
        entry.voice === requestedVoice
        && (typeof entry.target_model !== 'string' || entry.target_model === model)
      ))
    : undefined;
  if (requestedMatch && typeof requestedMatch.voice === 'string') {
    return requestedMatch.voice;
  }
  const promptMatch = existing.find((entry) => (
    entry.target_model === model
    && entry.voice_prompt === voicePrompt
    && typeof entry.voice === 'string'
  ));
  if (promptMatch && typeof promptMatch.voice === 'string') {
    return promptMatch.voice;
  }

  const previewText = (ctx.prompt.trim() || '你好，这是一次语音合成测试。').slice(0, 1024);
  const createResponse = await fetch(endpoint, requestInit(ctx, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'qwen-voice-design',
      input: {
        action: 'create',
        target_model: model,
        preferred_name: qwenPreferredVoiceName(model, voicePrompt),
        voice_prompt: voicePrompt,
        preview_text: previewText,
        language: voiceDesignLanguage(ctx),
      },
      parameters: {
        sample_rate: 24000,
        response_format: 'wav',
      },
    }),
  }));
  const created = await parseJsonResponse(createResponse, 'voice design create');
  const output = isRecord(created.output) ? created.output : null;
  const voice = typeof output?.voice === 'string' ? output.voice.trim() : '';
  if (!voice) throw new Error('dashscope voice design response missing output.voice');
  return voice;
}

export async function renderDashScopeSpeech(
  ctx: DashScopeMediaContext,
  credentials: MediaProviderConfigEntry,
): Promise<DashScopeRenderResult> {
  const apiKey = requireCredentials(credentials);
  const model = wireModel(ctx, credentials);
  const apiBase = dashScopeNativeBaseUrl(credentials.baseUrl);
  const voice = QWEN_VOICE_DESIGN_MODEL_RE.test(model)
    ? await resolveQwenDesignedVoice(ctx, apiKey, apiBase, model)
    : ctx.voice.trim() || 'Cherry';
  const languageType = dashScopeLanguageType(ctx.language);
  const input: Record<string, unknown> = {
    text: ctx.prompt.trim() || '你好，这是一次语音合成测试。',
    voice,
  };
  if (languageType) input.language_type = languageType;
  const response = await fetch(
    `${apiBase}/services/aigc/multimodal-generation/generation`,
    requestInit(ctx, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input,
      }),
    }),
  );
  const data = await parseJsonResponse(response, 'speech');
  const output = isRecord(data.output) ? data.output : null;
  const audio = isRecord(output?.audio) ? output.audio : null;
  const audioUrl = typeof audio?.url === 'string'
    ? audio.url.trim()
    : typeof output?.audio_url === 'string'
      ? output.audio_url.trim()
      : firstStringField(contentRows(data), ['audio', 'url']);
  if (!audioUrl) throw new Error('dashscope speech response missing output.audio.url');
  const { bytes, contentType } = await downloadAsset(audioUrl, ctx, 'speech');
  return {
    bytes,
    providerNote: `dashscope/${model} · ${voice} · ${bytes.length} bytes`,
    suggestedExt: audioExtension(contentType, audioUrl),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function renderDashScopeVideo(
  ctx: DashScopeMediaContext,
  credentials: MediaProviderConfigEntry,
  onProgress?: ProgressFn,
): Promise<DashScopeRenderResult> {
  const apiKey = requireCredentials(credentials);
  const apiBase = dashScopeNativeBaseUrl(credentials.baseUrl);
  const model = wireModel(ctx, credentials);
  const duration = typeof ctx.length === 'number' ? Math.min(30, Math.max(3, ctx.length)) : 5;
  const requestedResolution = ctx.resolution?.trim().toUpperCase();
  const resolution = requestedResolution && /^(?:480|720|1080)P$/.test(requestedResolution)
    ? requestedResolution
    : '720P';
  const input: Record<string, unknown> = {
    prompt: ctx.prompt || 'A short cinematic clip.',
  };
  if (ctx.imageRef?.dataUrl) {
    input.media = [{ type: 'first_frame', url: ctx.imageRef.dataUrl }];
  }

  const submitResponse = await fetch(
    `${apiBase}/services/aigc/video-generation/video-synthesis`,
    requestInit(ctx, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model,
        input,
        parameters: {
          resolution,
          ratio: ctx.imageRef ? 'adaptive' : ctx.aspect || '16:9',
          duration,
          prompt_extend: true,
        },
      }),
    }),
  );
  const submitData = await parseJsonResponse(submitResponse, 'video submit');
  const submitOutput = isRecord(submitData.output) ? submitData.output : submitData;
  const taskId = typeof submitOutput.task_id === 'string'
    ? submitOutput.task_id
    : typeof submitData.task_id === 'string'
      ? submitData.task_id
      : typeof submitData.id === 'string'
        ? submitData.id
        : '';
  let videoUrl = typeof submitOutput.video_url === 'string' ? submitOutput.video_url : '';
  if (!taskId && !videoUrl) throw new Error('dashscope video response missing task_id');

  const startedAt = Date.now();
  const configuredMaxMs = Number(process.env.OD_DASHSCOPE_VIDEO_MAX_POLL_MS);
  const maxMs = Number.isFinite(configuredMaxMs) && configuredMaxMs >= 60_000
    ? configuredMaxMs
    : 12 * 60 * 1000;
  const configuredIntervalMs = Number(process.env.OD_DASHSCOPE_VIDEO_POLL_INTERVAL_MS);
  const pollIntervalMs = Number.isFinite(configuredIntervalMs) && configuredIntervalMs >= 0
    ? configuredIntervalMs
    : 4000;
  let lastStatus = videoUrl
    ? 'SUCCEEDED'
    : typeof submitOutput.task_status === 'string'
      ? submitOutput.task_status.toUpperCase()
      : 'PENDING';
  if (!videoUrl) onProgress?.(`dashscope video task ${taskId} accepted; polling status…`);

  while (!videoUrl && Date.now() - startedAt < maxMs) {
    if (pollIntervalMs > 0) await sleep(pollIntervalMs);
    const pollResponse = await fetch(
      `${apiBase}/tasks/${encodeURIComponent(taskId)}`,
      requestInit(ctx, { headers: { authorization: `Bearer ${apiKey}` } }),
    );
    const pollData = await parseJsonResponse(pollResponse, 'video poll');
    const output = isRecord(pollData.output) ? pollData.output : pollData;
    lastStatus = typeof output.task_status === 'string'
      ? output.task_status.toUpperCase()
      : typeof output.status === 'string'
        ? output.status.toUpperCase()
        : '';
    onProgress?.(`dashscope video task ${taskId} status=${lastStatus || 'PENDING'} (elapsed ${Math.round((Date.now() - startedAt) / 1000)}s)`);
    if (['SUCCEEDED', 'COMPLETED', 'DONE'].includes(lastStatus)) {
      videoUrl = typeof output.video_url === 'string'
        ? output.video_url
        : typeof output.url === 'string'
          ? output.url
          : '';
      if (!videoUrl && Array.isArray(output.results) && isRecord(output.results[0])) {
        videoUrl = typeof output.results[0].url === 'string' ? output.results[0].url : '';
      }
      if (!videoUrl) throw new Error('dashscope video completed without video_url');
      break;
    }
    if (['FAILED', 'CANCELED', 'CANCELLED'].includes(lastStatus)) {
      const reason = typeof pollData.message === 'string'
        ? pollData.message
        : typeof output.message === 'string'
          ? output.message
          : typeof pollData.code === 'string'
            ? pollData.code
            : lastStatus;
      throw new Error(`dashscope video task ${lastStatus.toLowerCase()}: ${truncate(reason, 240)}`);
    }
  }
  if (!videoUrl) {
    throw new Error(`dashscope video did not finish in time (last status: ${lastStatus || 'unknown'})`);
  }
  const { bytes } = await downloadAsset(videoUrl, ctx, 'video');
  return {
    bytes,
    providerNote: `dashscope/${model} · ${ctx.aspect || '16:9'} · ${duration}s · ${bytes.length} bytes`,
    suggestedExt: '.mp4',
  };
}
