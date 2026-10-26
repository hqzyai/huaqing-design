import { Icon, type IconName } from './Icon';
// Shared presentational metadata for OD Library assets.
//
// The grid card (LibrarySection) and the preview modal (LibraryPreviewModal)
// both need to label an asset by kind, badge its source, and format its raw
// numbers. Keeping that here avoids two diverging copies of the same map.
//
// Copy is intentionally inline (not yet i18n-keyed) — the Library surface's
// localization is a tracked follow-up, matching LibrarySection.tsx.

import type {
  LibraryAsset,
  LibraryAssetKind,
  LibraryElementMeta,
  LibrarySourceKind,
} from '@open-design/contracts';

export const SOURCE_LABELS: Record<LibrarySourceKind, string> = {
  clipper: 'Clipper',
  'manual-upload': 'Upload',
  'agent-task': 'Agent',
  'design-system': 'Design system',
  generated: 'Generated',
};

/**
 * The badge identity an asset reads as. It is the storage `kind` for everything
 * except clipper element-pick captures: those are stored as `html` assets
 * (a self-contained snapshot of the picked node) enriched with `metadata.element`,
 * but should read as `element` so the badge does not mislabel a captured DOM
 * node as a plain HTML page. (Legacy element clips were `image` screenshots; the
 * `metadata.element` marker, not the storage kind, is what makes a clip read as
 * `element`.)
 */
export type BadgeKind = LibraryAssetKind | 'element';

/** Human label + accent tint for each badge kind, used by the kind badge. */
export const KIND_META: Record<BadgeKind, { label: string; tint: string }> = {
  image: { label: 'Image', tint: '#1A74FF' },
  video: { label: 'Video', tint: '#db2777' },
  'design-system': { label: 'Design system', tint: '#16a34a' },
  html: { label: 'HTML', tint: '#d97706' },
  font: { label: 'Font', tint: '#353535' },
  color: { label: 'Color', tint: '#0d9488' },
  text: { label: 'Text', tint: '#475569' },
  url: { label: 'Link', tint: '#0ea5e9' },
  element: { label: 'Element', tint: '#ea580c' },
};

/**
 * The captured DOM element summary for an element-pick clip, or `null` for any
 * other asset. Element clips are `html` assets (a self-contained snapshot of the
 * picked node) — or, for legacy captures, `image` screenshots — both carrying
 * `metadata.element`. Presence of that marker, not the storage kind, identifies
 * a clip, so this works across both shapes.
 */
export function elementMetaOf(asset: LibraryAsset): LibraryElementMeta | null {
  const element = (asset.metadata as { element?: LibraryElementMeta } | undefined)?.element;
  return element ?? null;
}

/** The badge identity for an asset — `element` for element-pick clips, else its `kind`. */
export function badgeKind(asset: LibraryAsset): BadgeKind {
  return elementMetaOf(asset) ? 'element' : asset.kind;
}

/** A badge-aware kind filter value: a badge kind, or `''` for "all kinds". */
export type KindFilterValue = BadgeKind | '';

/**
 * Whether an asset matches a badge-aware kind filter. Filtering keys off
 * {@link badgeKind} rather than the raw storage `kind`, so an element-pick clip
 * — an `html` snapshot enriched with `metadata.element` — is matched by the
 * `element` filter and excluded from the plain `html` filter. `''` matches
 * every asset. This is the single rule shared by the Library grid and the
 * "Import from library" picker so both surfaces agree on what each chip shows.
 */
export function matchesKindFilter(asset: LibraryAsset, filter: KindFilterValue): boolean {
  return !filter || badgeKind(asset) === filter;
}

export function kindLabel(kind: BadgeKind): string {
  return KIND_META[kind]?.label ?? kind;
}

export function kindTint(kind: BadgeKind): string {
  return KIND_META[kind]?.tint ?? '#475569';
}

export function primarySource(asset: LibraryAsset): LibrarySourceKind | null {
  return asset.sources?.[0]?.sourceKind ?? null;
}

export function originProjectId(asset: LibraryAsset): string | null {
  if (asset.originProjectId) return asset.originProjectId;
  const fromSource = asset.sources?.find((s) => s.projectId)?.projectId;
  return fromSource ?? null;
}

/**
 * The design system an asset belongs to (the `user:`-prefixed id), from its
 * provenance — drives the card's "Open design system" jump-link. Present on
 * assets the reconcile sync registered for a design system.
 */
export function originDesignSystemId(asset: LibraryAsset): string | null {
  return asset.sources?.find((s) => s.designSystemId)?.designSystemId ?? null;
}

/** Best display title for an asset, falling back through its provenance. */
export function assetTitle(asset: LibraryAsset): string {
  return (
    asset.sourceTitle ||
    asset.caption ||
    asset.sourceDomain ||
    asset.relPath?.split('/').pop() ||
    `${kindLabel(asset.kind)} · ${asset.id.slice(0, 8)}`
  );
}

export function formatBytes(n?: number): string | null {
  if (!n || n <= 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(ts?: number): string | null {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}

/** CSS `font-family` name for an injected `@font-face` of a font asset. */
export function fontFamilyFor(assetId: string): string {
  return `od-lib-font-${assetId}`;
}

/** First palette swatch, else a hex parsed out of free text, else null. */
export function colorOf(asset: LibraryAsset, rawText?: string | null): string | null {
  const fromPalette = asset.palette?.find((c) => typeof c === 'string' && c.trim());
  if (fromPalette) return fromPalette.trim();
  const text = (rawText ?? '').trim();
  const hex = /#[0-9a-f]{3,8}\b/i.exec(text)?.[0];
  if (hex) return hex;
  const fn = /\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/i.exec(text)?.[0];
  return fn ?? null;
}

interface KindIconProps {
  kind: BadgeKind;
  size?: number;
  className?: string;
}

/** Library kinds share the application's official Lucide icon vocabulary. */
export function KindIcon({ kind, size = 16, className }: KindIconProps) {
  const names: Partial<Record<BadgeKind, IconName>> = {
    image: 'image', video: 'video', html: 'code', 'design-system': 'swatchbook',
    font: 'type', color: 'palette', url: 'link', element: 'scan', text: 'text',
  };
  const name = Object.hasOwn(names, kind) ? names[kind] : undefined;
  return <Icon name={name ?? 'text'} size={size} className={className} />;
}
