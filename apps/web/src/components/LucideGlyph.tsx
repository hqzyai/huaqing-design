import type { SVGProps } from 'react';
import type { LucideIcon } from 'lucide-react';
import styles from './LucideGlyph.module.css';

interface Props extends SVGProps<SVGSVGElement> {
  glyph: LucideIcon;
  size?: number | string;
}

/** App-owned presentation, with the official component's SVG root intact. */
export function LucideGlyph({ glyph: Glyph, size = 16, strokeWidth = 1.75, className, ...rest }: Props) {
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth={false}
      aria-hidden="true"
      focusable="false"
      {...rest}
      className={[styles.glyph, className].filter(Boolean).join(' ')}
    />
  );
}
