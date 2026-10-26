export const MEDIA_EXECUTION_MODES = [
  'enabled',
  'disabled',
] as const;

export type MediaExecutionMode = (typeof MEDIA_EXECUTION_MODES)[number];

export const MEDIA_SURFACES = [
  'image',
  'video',
  'audio',
] as const;

export type MediaSurface = (typeof MEDIA_SURFACES)[number];

export const MEDIA_POLICY_DENIAL_CODES = [
  'MEDIA_EXECUTION_DISABLED',
  'MEDIA_SURFACE_DENIED',
  'MEDIA_MODEL_DENIED',
] as const;

export type MediaPolicyDenialCode = (typeof MEDIA_POLICY_DENIAL_CODES)[number];

/**
 * Run-scoped policy controlling OpenDesign-owned media generation only.
 *
 * `allowedSurfaces` and `allowedModels` apply solely to `/api/tools/media/generate`
 * and in-run `od media generate`. External MCP media tools are intentionally
 * unaffected: provider policy for those belongs to the MCP server / orchestrator.
 */
export interface MediaExecutionPolicy {
  mode: MediaExecutionMode;
  allowedSurfaces?: MediaSurface[];
  allowedModels?: string[];
}

export const DEFAULT_MEDIA_EXECUTION_POLICY: MediaExecutionPolicy = {
  mode: 'enabled',
};

export interface MediaPolicyTarget {
  surface: MediaSurface;
  model?: string;
}

export interface MediaPolicyDenial {
  code: MediaPolicyDenialCode;
  message: string;
}

/**
 * Optional provider-level wire-model overrides.
 *
 * `model` is the legacy catch-all slot retained for configs written by older
 * clients. New clients should write the surface-specific fields so one
 * provider credential can safely serve image, video, transcription, and
 * speech synthesis without one model id leaking into another endpoint.
 */
export const MEDIA_PROVIDER_MODEL_FIELDS = [
  'model',
  'imageModel',
  'videoModel',
  'sttModel',
  'ttsModel',
] as const;

export type MediaProviderModelField = (typeof MEDIA_PROVIDER_MODEL_FIELDS)[number];

export interface MediaProviderModelOverrides {
  model?: string;
  imageModel?: string;
  videoModel?: string;
  sttModel?: string;
  ttsModel?: string;
}

export interface MediaProviderConfigEntry extends MediaProviderModelOverrides {
  apiKey?: string;
  baseUrl?: string;
}

export interface MediaProviderConfigWriteEntry extends MediaProviderConfigEntry {
  preserveApiKey?: boolean;
}

export interface MediaProviderConfigWriteRequest {
  providers: Record<string, MediaProviderConfigWriteEntry>;
  force?: boolean;
}

export interface MaskedMediaProviderConfigEntry extends MediaProviderModelOverrides {
  configured: boolean;
  source: string;
  apiKeyTail: string;
  baseUrl: string;
}

export interface MediaProviderConfigResponse {
  providers: Record<string, MaskedMediaProviderConfigEntry>;
  aliases: {
    effective: Record<string, string>;
    env: Record<string, string>;
    stored: Record<string, string>;
  };
}

export const MEDIA_PROVIDER_CATALOG_TYPES = [
  'image',
  'video',
  'stt',
  'tts',
] as const;

export type MediaProviderCatalogType = (typeof MEDIA_PROVIDER_CATALOG_TYPES)[number];

export interface MediaProviderCatalogRequest {
  providerId: string;
  type: MediaProviderCatalogType;
  apiKey?: string;
  baseUrl?: string;
}

export interface MediaProviderCatalogOption {
  id: string;
  label: string;
}

export interface MediaProviderCatalogResponse {
  ok: boolean;
  type: MediaProviderCatalogType;
  models: MediaProviderCatalogOption[];
  detail?: string;
  status?: number;
}

/**
 * Stable model id carried through project metadata and `od media generate`
 * when the user picks a provider-scoped model saved in Settings.
 *
 * The provider id is part of the reference because two OpenAI-compatible
 * gateways can expose the same wire model name while requiring different
 * credentials and base URLs.
 */
export const CONFIGURED_MEDIA_MODEL_ID_PREFIX = 'configured-media:';

export interface ConfiguredMediaModelId {
  providerId: string;
  type: MediaProviderCatalogType;
  model: string;
}

export function encodeConfiguredMediaModelId(input: ConfiguredMediaModelId): string {
  const providerId = input.providerId.trim();
  const model = input.model.trim();
  if (!providerId || !model || !MEDIA_PROVIDER_CATALOG_TYPES.includes(input.type)) {
    throw new Error('configured media model requires a provider, type, and model');
  }
  return `${CONFIGURED_MEDIA_MODEL_ID_PREFIX}${encodeURIComponent(providerId)}:${input.type}:${encodeURIComponent(model)}`;
}

export function decodeConfiguredMediaModelId(value: string): ConfiguredMediaModelId | null {
  if (!value.startsWith(CONFIGURED_MEDIA_MODEL_ID_PREFIX)) return null;
  const encoded = value.slice(CONFIGURED_MEDIA_MODEL_ID_PREFIX.length).split(':');
  if (encoded.length !== 3) return null;
  const [encodedProviderId, rawType, encodedModel] = encoded;
  const type = MEDIA_PROVIDER_CATALOG_TYPES.find((candidate) => candidate === rawType);
  if (!encodedProviderId || !type || !encodedModel) return null;
  try {
    const providerId = decodeURIComponent(encodedProviderId).trim();
    const model = decodeURIComponent(encodedModel).trim();
    return providerId && model ? { providerId, type, model } : null;
  } catch {
    return null;
  }
}

export function mediaExecutionPolicyDenial(
  policy: MediaExecutionPolicy,
  target: MediaPolicyTarget,
): MediaPolicyDenial | null {
  if (policy.mode === 'disabled') {
    return {
      code: 'MEDIA_EXECUTION_DISABLED',
      message: 'media generation is disabled for this run',
    };
  }
  if (
    Array.isArray(policy.allowedSurfaces) &&
    policy.allowedSurfaces.length > 0 &&
    !policy.allowedSurfaces.includes(target.surface)
  ) {
    return {
      code: 'MEDIA_SURFACE_DENIED',
      message: `media surface "${target.surface}" is not allowed for this run`,
    };
  }
  if (
    target.model &&
    Array.isArray(policy.allowedModels) &&
    policy.allowedModels.length > 0 &&
    !policy.allowedModels.includes(target.model)
  ) {
    return {
      code: 'MEDIA_MODEL_DENIED',
      message: `media model "${target.model}" is not allowed for this run`,
    };
  }
  return null;
}

/** Request for Open Design's deterministic local HyperFrames scaffold. */
export interface HyperFramesScaffoldRequest {
  /** Project-relative path in the form `.hyperframes-cache/<id>`. */
  compositionDir: string;
}

/** Files created before the agent authors the composition HTML. */
export interface HyperFramesScaffoldResponse {
  compositionDir: string;
  files: ['hyperframes.json', 'meta.json', 'index.html'];
}
