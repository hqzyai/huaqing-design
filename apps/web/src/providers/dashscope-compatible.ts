/**
 * DashScope chat provider. Chat uses DashScope's official OpenAI-compatible
 * wire format, but deliberately travels through its own daemon route so it
 * does not inherit OpenAI provider routing, logging, or future special cases.
 */
import type { AppConfig, ChatMessage } from '../types';
import type { StreamHandlers } from './anthropic';
import { streamProxyEndpoint } from './api-proxy';

export async function streamMessageDashScope(
  cfg: AppConfig,
  system: string,
  history: ChatMessage[],
  signal: AbortSignal,
  handlers: StreamHandlers,
): Promise<void> {
  return streamProxyEndpoint(
    '/api/proxy/dashscope/stream',
    cfg,
    system,
    history,
    signal,
    handlers,
  );
}
