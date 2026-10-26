import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PRODUCT_NAME,
  PRODUCT_NAME,
  brandProductText,
  resolveProductName,
} from '../../src/config/branding';

describe('web UI branding', () => {
  it('ships with the requested default product name', () => {
    expect(DEFAULT_PRODUCT_NAME).toBe('华清智言 design');
  });

  it('uses and trims the operator-configured product name', () => {
    expect(resolveProductName('  Example Design  ')).toBe('Example Design');
    expect(resolveProductName('   ')).toBe(DEFAULT_PRODUCT_NAME);
  });

  it('replaces standalone legacy product names with the configured name', () => {
    expect(brandProductText('OpenDesign Cloud · Open Design Labs')).toBe(
      `${PRODUCT_NAME} Cloud · ${PRODUCT_NAME} Labs`,
    );
    expect(brandProductText('Welcome to {productName}')).toBe(`Welcome to ${PRODUCT_NAME}`);
  });

  it('preserves technical identifiers and external social handles', () => {
    expect(brandProductText('OpenDesignHost @OpenDesignHQ OpenDesignComponent')).toBe(
      'OpenDesignHost @OpenDesignHQ OpenDesignComponent',
    );
  });
});
