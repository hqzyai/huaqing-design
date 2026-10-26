import { forwardRef } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

import { joinClassNames } from './class-names';
import styles from './form-controls.module.css';

// shadcn/ui Input and Textarea, adapted to React 18 forwardRef and our CSS
// Modules. Native event/ref/value contracts remain unchanged (see SHADCN.md).

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} data-slot="input" className={joinClassNames(styles.control, className)} {...props} />;
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} data-slot="textarea" className={joinClassNames(styles.control, styles.textarea, className)} {...props} />;
});

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, ...props },
  ref,
) {
  // Keep the native numeric size/multiple API and the original DOM shape;
  // shadcn NativeSelect's size variant and wrapper are not equivalent here.
  return <select ref={ref} className={joinClassNames(styles.control, styles.select, className)} {...props} />;
});
