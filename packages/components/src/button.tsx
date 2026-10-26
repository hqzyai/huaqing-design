import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';

import { joinClassNames } from './class-names';
import styles from './button.module.css';

// Adapted from shadcn/ui's native Button branch. See SHADCN.md for source
// provenance and the React 18 / CSS Modules compatibility decisions.

export type ButtonVariant = 'default' | 'primary' | 'primary-ghost' | 'ghost' | 'subtle';
export type ButtonSize = 'default' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClassNames: Record<ButtonVariant, string | undefined> = {
  default: undefined,
  primary: joinClassNames(styles.primary, 'primary'),
  'primary-ghost': joinClassNames(styles.primaryGhost, 'primary-ghost'),
  ghost: joinClassNames(styles.ghost, 'ghost'),
  subtle: joinClassNames(styles.subtle, 'subtle'),
};

const sizeClassNames: Record<ButtonSize, string | undefined> = {
  default: undefined,
  icon: joinClassNames(styles.icon, 'icon-btn'),
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, type = 'button', variant = 'default', size = 'default', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      data-slot="button"
      type={type}
      className={joinClassNames(
        styles.button,
        variantClassNames[variant],
        sizeClassNames[size],
        className,
      )}
      {...props}
    />
  );
});
