import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { InstalledPluginRecord, PluginManifest } from '@open-design/contracts';
import { applyPlugin } from '../../apps/daemon/src/plugins/apply.js';
import { pluginInputsAreValid } from '../../apps/web/src/utils/pluginRequiredInputs.js';

const folder = new URL('../../plugins/_official/examples/live-dashboard/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('open-design.json', folder), 'utf8')) as PluginManifest;
const plugin: InstalledPluginRecord = {
  id: manifest.name,
  title: manifest.title ?? manifest.name,
  version: manifest.version,
  sourceKind: 'bundled',
  source: fileURLToPath(folder),
  fsPath: fileURLToPath(folder),
  trust: 'bundled',
  capabilitiesGranted: ['prompt:inject', 'fs:write'],
  installedAt: 0,
  updatedAt: 0,
  manifest,
};
const registry = { skills: [], designSystems: [], craft: [], atoms: [] };

describe('live dashboard in a standalone workspace', () => {
  it('[P1] can start from Home and apply without a cloud Workspace name', () => {
    expect(pluginInputsAreValid(manifest.od?.inputs ?? [], {})).toBe(true);
    const { result } = applyPlugin({ plugin, inputs: {}, registry });
    expect(result.appliedPlugin.pluginId).toBe(manifest.name);
    // The generator resolves the display name from its project cwd; apply
    // must not invent a tenant, directory, or hardcoded display name.
    expect(result.appliedPlugin.inputs.workspace_name).toBeUndefined();
  });

  it('[P1] preserves an explicitly supplied workspace display name', () => {
    const { result } = applyPlugin({
      plugin, inputs: { workspace_name: '用户的工作区' }, registry,
    });
    expect(result.appliedPlugin.inputs.workspace_name).toBe('用户的工作区');
  });
});
