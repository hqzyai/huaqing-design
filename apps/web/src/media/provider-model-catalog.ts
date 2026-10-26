import type {
  MediaProviderCatalogRequest,
  MediaProviderCatalogResponse,
} from '@open-design/contracts';

export async function fetchMediaProviderCatalog(
  input: MediaProviderCatalogRequest,
  signal?: AbortSignal,
): Promise<MediaProviderCatalogResponse> {
  const response = await fetch('/api/media/providers/models', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  const payload = await response.json().catch(() => null) as
    | MediaProviderCatalogResponse
    | { error?: string; detail?: string }
    | null;
  if (!response.ok) {
    const detail = payload && typeof payload.detail === 'string' ? payload.detail : '';
    const error = payload && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : '';
    return {
      ok: false,
      type: input.type,
      models: [],
      status: response.status,
      detail: detail || error || `Daemon responded with ${response.status}`,
    };
  }
  if (!payload || !('ok' in payload)) {
    return {
      ok: false,
      type: input.type,
      models: [],
      detail: 'Daemon returned an invalid model catalog response',
    };
  }
  return payload;
}
