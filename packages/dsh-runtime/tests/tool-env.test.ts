import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { ShellEnvRegistry } from '@deepseek-ai/dsh-shell-env';
import { describe, test } from 'vitest';
import { registerToolTokenEnv } from '../src/tool-env.js';

const execution = { signal: new AbortController().signal } as Parameters<ShellEnvRegistry['collect']>[0];

function registry() {
  return new ShellEnvRegistry(new Context(), { dshHome: '/fixture/dsh' });
}

describe('Harness shell authorization bridge', () => {
  test('forwards only the scoped tool grant, without exposing credential values in declarations', () => {
    const shell = registry();
    const dispose = registerToolTokenEnv(shell, {
      OD_TOOL_TOKEN: 'run-one-grant',
      OD_API_TOKEN: 'daemon-secret',
      DEEPSEEK_API_KEY: 'provider-secret',
      DASHSCOPE_API_KEY: 'image-secret',
    });
    const values = shell.collect(execution);
    assert.equal(values.DSH_OD_TOOL_TOKEN, 'run-one-grant');
    assert.equal(Object.values(values).some(value => value.includes('secret')), false);
    assert.equal(JSON.stringify(shell.list()).includes('run-one-grant'), false);
    dispose();
    assert.equal(shell.collect(execution).DSH_OD_TOOL_TOKEN, undefined);
  });

  test('keeps concurrent profile grants independent and never inherits a stale alias', () => {
    const one = registry();
    const two = registry();
    const none = registry();
    const env = { OD_TOOL_TOKEN: 'run-one' };
    registerToolTokenEnv(one, env);
    registerToolTokenEnv(two, { OD_TOOL_TOKEN: 'run-two' });
    registerToolTokenEnv(none, { DSH_OD_TOOL_TOKEN: 'stale-token', OD_API_TOKEN: 'daemon-token' });
    env.OD_TOOL_TOKEN = 'changed-parent';
    assert.equal(one.collect(execution).DSH_OD_TOOL_TOKEN, 'run-one');
    assert.equal(two.collect(execution).DSH_OD_TOOL_TOKEN, 'run-two');
    assert.equal(none.collect(execution).DSH_OD_TOOL_TOKEN, undefined);
  });
});
