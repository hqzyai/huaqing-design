import { describe, expect, it } from 'vitest';
import { readExpandedIndexCss } from '../helpers/read-expanded-css';

const indexCss = readExpandedIndexCss();

function cssBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...indexCss.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  if (!matches.length) throw new Error(`Missing CSS block for ${selector}`);
  return matches.map((match) => match[1]).join('\n');
}

describe('default app background colors', () => {
  it('uses the release light background color by default', () => {
    const root = cssBlock(':root');

    expect(root).toContain('--ui-background: #ffffff;');
    expect(root).toContain('--bg: var(--ui-background);');
    expect(root).toContain('--bg-app: var(--ui-background);');
  });

  it('maps the dark background to the shared neutral palette', () => {
    const dark = cssBlock('[data-theme="dark"]');

    expect(dark).toContain('--ui-background: #0a0a0a;');
    expect(dark).toContain('--bg: var(--ui-background);');
    expect(dark).toContain('--bg-app: var(--ui-background);');
  });

  it('uses the same self-hosted Latin and Chinese UI fonts across application surfaces', () => {
    const root = cssBlock(':root');
    const sans = /--sans:\s*([^;]+);/.exec(root)?.[1];

    expect(sans).toBeDefined();
    expect(sans).toBe('"Geist", "Noto Sans SC", sans-serif');
    expect(indexCss).toContain('font-family: "Geist";');
    expect(indexCss).toContain('font-family: "Noto Sans SC";');
  });
});
