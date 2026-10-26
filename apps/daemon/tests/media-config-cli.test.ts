import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const daemonRoot = fileURLToPath(new URL('..', import.meta.url));
const cliEntry = fileURLToPath(new URL('../src/cli.ts', import.meta.url));

let server: http.Server | undefined;
let baseUrl = '';
let writes: unknown[] = [];

const maskedConfig = {
  providers: {
    openai: {
      configured: true,
      source: 'stored',
      apiKeyTail: '1234',
      baseUrl: 'https://api.openai.com/v1',
      imageModel: 'gpt-image-existing',
    },
    aihubmix: {
      configured: false,
      source: 'unset',
      apiKeyTail: '',
      baseUrl: '',
    },
  },
  aliases: { effective: {}, env: {}, stored: {} },
};

beforeEach(async () => {
  writes = [];
  server = http.createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      if (req.method === 'GET' && req.url === '/api/media/config') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(maskedConfig));
        return;
      }
      if (req.method === 'PUT' && req.url === '/api/media/config') {
        writes.push(JSON.parse(body));
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(maskedConfig));
        return;
      }
      if (req.method === 'POST' && req.url === '/api/media/providers/models') {
        writes.push(JSON.parse(body));
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          type: 'video',
          models: [{ id: 'video-custom', label: 'Video Custom' }],
        }));
        return;
      }
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end('{}');
    });
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server did not bind');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

async function runCli(args: string[]) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', cliEntry, ...args], {
      cwd: daemonRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

describe('od media config', () => {
  it('writes independent model fields while preserving other stored providers', async () => {
    const result = await runCli([
      'media', 'config', 'set', 'aihubmix',
      '--api-key', 'sk-aihubmix',
      '--image-model', 'image-custom',
      '--video-model', 'video-custom',
      '--stt-model', 'stt-custom',
      '--tts-model', 'tts-custom',
      '--daemon-url', baseUrl,
      '--json',
    ]);

    expect(result, result.stderr).toMatchObject({ code: 0 });
    expect(writes).toEqual([{
      providers: {
        openai: {
          preserveApiKey: true,
          baseUrl: 'https://api.openai.com/v1',
          imageModel: 'gpt-image-existing',
        },
        aihubmix: {
          apiKey: 'sk-aihubmix',
          imageModel: 'image-custom',
          videoModel: 'video-custom',
          sttModel: 'stt-custom',
          ttsModel: 'tts-custom',
        },
      },
      force: false,
    }]);
  });

  it('lists provider models for one media type', async () => {
    const result = await runCli([
      'media', 'config', 'models', 'openai',
      '--type', 'video',
      '--daemon-url', baseUrl,
      '--json',
    ]);

    expect(result, result.stderr).toMatchObject({ code: 0 });
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      type: 'video',
      models: [{ id: 'video-custom' }],
    });
    expect(writes).toEqual([{ providerId: 'openai', type: 'video' }]);
  });
});
