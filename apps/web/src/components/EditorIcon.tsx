// Per-editor icon for the hand-off menu. Real product marks are bundled as
// PNGs under `apps/web/public/editor-icons/` (downscaled from official 512px
// app icons) and rendered as plain <img> so each brand's own tile shape,
// colors, and rounding are preserved. Only generic destinations without brand
// artwork (Explorer / File Manager) use the shared Lucide folder glyph.

import { Icon } from './Icon';
import type { HostEditorId } from '@open-design/contracts';

interface Props {
  editorId: HostEditorId | string;
  size?: number;
}

// Editors with a bundled brand asset. `mono: true` marks bare single-color
// glyphs (no baked tile) that must follow the theme's text color — rendered
// as a CSS-masked span, same pattern as AgentIcon's MONO_ICONS, so the mark
// stays legible on dark panels.
const IMAGE_ICONS: Record<string, { mono?: boolean }> = {
  cursor: {},
  vscode: {},
  qoder: {},
  xcode: {},
  finder: {},
  terminal: {},
  zed: {},
  antigravity: {},
  webstorm: {},
  idea: {},
  warp: {},
  windsurf: { mono: true },
};

function folderLogo(size: number) {
  const s = size * 0.76;
  return (
    <Icon name="folder" size={s} />
  );
}

interface EditorVisual {
  bg: string;
  fg: string;
  glyph: (size: number) => JSX.Element;
}

const EDITORS: Record<string, EditorVisual> = {
  explorer: { bg: '#fbbf24', fg: '#1a1a1a', glyph: folderLogo },
  'file-manager': { bg: '#6b7280', fg: '#ffffff', glyph: folderLogo },
};

export function EditorIcon({ editorId, size = 16 }: Props) {
  const image = IMAGE_ICONS[editorId];
  if (image) {
    const src = `/editor-icons/${editorId}.png`;
    if (image.mono) {
      return (
        <span
          className="editor-icon editor-icon-mask"
          style={{
            width: size,
            height: size,
            WebkitMaskImage: `url("${src}")`,
            maskImage: `url("${src}")`,
          }}
          aria-hidden="true"
        />
      );
    }
    return (
      <img
        className="editor-icon editor-icon-img"
        src={src}
        alt=""
        width={size}
        height={size}
        aria-hidden="true"
        draggable={false}
      />
    );
  }
  const visual = EDITORS[editorId];
  if (!visual) {
    // Fallback — match a neutral folder tile rather than the abstract
    // global handoff glyph the previous design used.
    return (
      <span
        className="editor-icon"
        style={{
          width: size,
          height: size,
          background: '#9ca3af',
          color: '#ffffff',
        }}
      >
        <Icon name="folder" size={size * 0.6} />
      </span>
    );
  }
  return (
    <span
      className="editor-icon"
      style={{ width: size, height: size, background: visual.bg, color: visual.fg }}
    >
      {visual.glyph(size)}
    </span>
  );
}
