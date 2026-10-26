import type { SVGProps } from 'react';
import { BRAND_ICON_PATHS } from './brand-icon-paths';
import { LUCIDE_ICONS } from './lucide-icons';
import { LucideGlyph } from './LucideGlyph';

export type IconName = keyof typeof LUCIDE_ICONS | 'discord' | 'github' | 'github-filled';

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number | string;
}

const BRAND_NAMES: Partial<Record<IconName, string>> = {
  discord: 'discord-line',
  github: 'github-line',
  'github-filled': 'github-fill',
};

/** Existing semantic names and SVG/aria/event props; official Lucide UI glyphs. */
export function Icon({ name, size = 16, strokeWidth = 1.75, className, ...rest }: Props) {
  const iconClass = `od-icon${name === 'spinner' ? ' icon-spin' : ''}${className ? ` ${className}` : ''}`;
  const brandName = Object.hasOwn(BRAND_NAMES, name) ? BRAND_NAMES[name] : undefined;
  if (brandName) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
        aria-hidden focusable="false" className={iconClass} {...rest}>
        <path d={BRAND_ICON_PATHS[brandName]} />
      </svg>
    );
  }
  const glyph = Object.hasOwn(LUCIDE_ICONS, name) ? LUCIDE_ICONS[name as keyof typeof LUCIDE_ICONS] : undefined;
  // Preserve the previous null fallback for an unknown external name.
  return glyph ? <LucideGlyph glyph={glyph} size={size} strokeWidth={strokeWidth} className={iconClass} {...rest} /> : null;
}
