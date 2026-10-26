import {
  encodeConfiguredMediaModelId,
  type MediaProviderCatalogType,
} from '@open-design/contracts';
import { isStoredMediaProviderEntryPresent } from '../state/config';
import type { MediaProviderCredentials } from '../types';
import {
  MEDIA_PROVIDERS,
  findMediaModel,
  findProvider,
  type MediaModel,
  type MediaProviderId,
} from './models';

export function isMediaProviderPickerReady(
  providerId: MediaProviderId,
  mediaProviders?: Record<string, MediaProviderCredentials>,
): boolean {
  const provider = findProvider(providerId);
  if (!provider?.integrated) return false;
  if (mediaProviders === undefined) return true;
  if (provider.credentialsRequired === false) return true;
  const entry = mediaProviders?.[provider.id];
  if (provider.id === 'openai' && isOpenAIOAuthOnlyEntry(entry)) return false;
  return isStoredMediaProviderEntryPresent(entry);
}

export function isMediaModelPickerReady(
  modelId: string,
  mediaProviders?: Record<string, MediaProviderCredentials>,
): boolean {
  const model = findMediaModel(modelId);
  if (!model) return false;
  return isMediaProviderPickerReady(model.provider, mediaProviders);
}

/**
 * Limit a model picker to provider routes that can run with the currently
 * loaded credential state. Keep catalogue order stable so existing defaults
 * do not jump merely because another provider was configured.
 */
export function readyMediaModels(
  models: MediaModel[],
  mediaProviders?: Record<string, MediaProviderCredentials>,
): MediaModel[] {
  if (mediaProviders === undefined) return models;
  return models.filter((model) =>
    isMediaProviderPickerReady(model.provider, mediaProviders),
  );
}

/**
 * Add the exact provider-scoped model saved in Settings to a model picker.
 * The synthetic id preserves provider identity all the way to the daemon;
 * raw wire ids alone are ambiguous across OpenAI-compatible gateways.
 */
export function withConfiguredMediaModels(
  models: MediaModel[],
  type: Extract<MediaProviderCatalogType, 'image' | 'video' | 'tts'>,
  mediaProviders?: Record<string, MediaProviderCredentials>,
): MediaModel[] {
  if (!mediaProviders) return models;
  const configured: MediaModel[] = [];
  for (const provider of MEDIA_PROVIDERS) {
    if (!isMediaProviderPickerReady(provider.id, mediaProviders)) continue;
    const entry = mediaProviders[provider.id];
    const scoped = type === 'image'
      ? entry?.imageModel?.trim()
      : type === 'video'
        ? entry?.videoModel?.trim()
        : entry?.ttsModel?.trim();
    const legacy = entry?.model?.trim();
    const wireModel = scoped || legacyModelForType(provider.id, legacy, type);
    if (!wireModel) continue;

    const existingIndex = models.findIndex((model) => (
      model.provider === provider.id && model.id === wireModel
    ));
    if (existingIndex >= 0) {
      const next = [...models];
      next[existingIndex] = {
        ...next[existingIndex]!,
        id: encodeConfiguredMediaModelId({ providerId: provider.id, type, model: wireModel }),
        label: `${wireModel} (${provider.label} · configured)`,
        hint: `${provider.label} · configured in Settings`,
      };
      models = next;
      continue;
    }

    configured.push({
      id: encodeConfiguredMediaModelId({ providerId: provider.id, type, model: wireModel }),
      label: `${wireModel} (${provider.label} · configured)`,
      hint: `${provider.label} · configured in Settings`,
      provider: provider.id,
      caps: type === 'image' ? ['t2i', 'i2i'] : type === 'video' ? ['t2v', 'i2v'] : ['tts'],
    });
  }
  return configured.length > 0 ? [...models, ...configured] : models;
}

function legacyModelForType(
  providerId: string,
  model: string | undefined,
  type: Extract<MediaProviderCatalogType, 'image' | 'video' | 'tts'>,
): string {
  if (!model) return '';
  if (providerId !== 'volcengine') return model;
  if (type === 'tts') return /tts|speech|voice/i.test(model) ? model : '';
  return volcengineModelMatchesSurface(model, type) ? model : '';
}

/**
 * Volcengine uses one credential slot for both Seedream and Seedance, but each
 * surface now has its own model override. The legacy catch-all `model` remains
 * readable only when its name clearly matches the active surface.
 */
export function labelConfiguredVolcengineModel(
  models: MediaModel[],
  surface: 'image' | 'video',
  mediaProviders?: Record<string, MediaProviderCredentials>,
): MediaModel[] {
  const entry = mediaProviders?.volcengine;
  const scopedModel = surface === 'image'
    ? entry?.imageModel?.trim()
    : entry?.videoModel?.trim();
  const legacyModel = entry?.model?.trim();
  const configuredModel = scopedModel
    || (legacyModel && volcengineModelMatchesSurface(legacyModel, surface) ? legacyModel : '');
  if (!configuredModel) {
    return models;
  }
  const requiredCapability = surface === 'image' ? 't2i' : 't2v';
  const target = models.find((model) =>
    model.provider === 'volcengine' && model.caps?.includes(requiredCapability),
  );
  if (!target) return models;
  return models.map((model) =>
    model.id === target.id
      ? {
          ...model,
          label: `${configuredModel} (configured)`,
          hint: `Volcengine Ark · ${surface} model configured in Settings`,
        }
      : model,
  );
}

export function volcengineModelMatchesSurface(
  model: string,
  surface: 'image' | 'video',
): boolean {
  const normalized = model.trim().toLowerCase();
  if (!normalized) return false;
  return surface === 'image'
    ? /seedream|seededit|image/.test(normalized)
    : /seedance|video/.test(normalized);
}

function isOpenAIOAuthOnlyEntry(entry: MediaProviderCredentials | null | undefined): boolean {
  const source = entry?.source?.trim();
  return (source === 'oauth-codex' || source === 'oauth-hermes')
    && !entry?.apiKey?.trim()
    && !entry?.baseUrl?.trim()
    && !entry?.model?.trim()
    && !entry?.apiKeyTail?.trim();
}
