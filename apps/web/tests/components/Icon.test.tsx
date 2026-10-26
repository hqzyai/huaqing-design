// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Icon, type IconName } from '../../src/components/Icon';
import { RemixIcon } from '../../src/components/RemixIcon';

afterEach(cleanup);

describe('icon adapter contracts', () => {
  it('keeps SVG event handlers, caller styles, accessible names and children on the same root', () => {
    const onClick = vi.fn();
    const { container } = render(
      <Icon name="search" size="1.25rem" role="img" aria-hidden={false} aria-label="Search files"
        style={{ color: 'red' }} onClick={onClick}><title>Search files</title></Icon>,
    );
    const icon = screen.getByRole('img', { name: 'Search files' });
    expect(icon.tagName.toLowerCase()).toBe('svg');
    expect(container.firstElementChild).toBe(icon);
    expect(icon.getAttribute('width')).toBe('1.25rem');
    expect(icon.querySelector('title')?.textContent).toBe('Search files');
    fireEvent.click(icon);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('leaves action names and keyboard focus on the containing control', () => {
    render(<button aria-label="Close preview"><Icon name="close" /></button>);
    const button = screen.getByRole('button', { name: 'Close preview' });
    button.focus();
    expect(document.activeElement).toBe(button);
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(button.querySelector('svg')?.getAttribute('focusable')).toBe('false');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it.each(['missing-icon', '__proto__', 'constructor'])('preserves unknown-name fallbacks for %s', (name) => {
    expect(renderToStaticMarkup(<Icon name={name as IconName} />)).toBe('');
    const { container } = render(<RemixIcon name={name} size={16} />);
    const placeholder = container.firstElementChild;
    expect(placeholder?.tagName.toLowerCase()).toBe('svg');
    expect(placeholder?.getAttribute('width')).toBe('16');
    expect(placeholder?.children.length).toBe(0);
  });

  it('accepts existing data-driven names while retaining the empty fallback when a value changes', () => {
    const { container, rerender } = render(<RemixIcon name="checkbox-line" className="selection" />);
    expect(container.querySelector('svg')?.childElementCount).toBeGreaterThan(0);
    rerender(<RemixIcon name="checkbox-blank-line" className="selection" />);
    expect(container.querySelector('svg')?.childElementCount).toBeGreaterThan(0);
    rerender(<RemixIcon name="future-data-value" className="selection" />);
    expect(container.querySelector('svg')?.childElementCount).toBe(0);
  });
});
