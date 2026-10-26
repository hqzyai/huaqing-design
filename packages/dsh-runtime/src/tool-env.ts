import type { ShellEnvRegistry } from '@deepseek-ai/dsh-shell-env';

/** Forward only the daemon's ephemeral grant through Harness's trusted shell seam. */
export function registerToolTokenEnv(
  registry: Pick<ShellEnvRegistry, 'register'>,
  env: NodeJS.ProcessEnv = process.env,
): () => void {
  // Each profile process serves one run. Capture its grant, never provider keys
  // or the daemon's API token, and leave expiry/revocation to the daemon registry.
  const token = env.OD_TOOL_TOKEN;
  return registry.register({
    name: 'open-design-tool-token',
    variables: {
      DSH_OD_TOOL_TOKEN: {
        description: 'Run-scoped OpenDesign authorization, consumed automatically by od. Never print or persist it.',
      },
    },
    resolve: () => token ? { DSH_OD_TOOL_TOKEN: token } : {},
  });
}
