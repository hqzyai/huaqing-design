/**
 * Operator-configurable product branding for the web UI.
 *
 * `OD_UI_PRODUCT_NAME` is resolved in next.config.ts and exposed to the client
 * as `NEXT_PUBLIC_OD_UI_PRODUCT_NAME`. Keeping the fallback here makes isolated
 * component tests and non-Next consumers use the same name as a normal build.
 */
export const DEFAULT_PRODUCT_NAME = '华清智言 design';

export function resolveProductName(configuredName?: string): string {
  return configuredName?.trim() || DEFAULT_PRODUCT_NAME;
}

export const PRODUCT_NAME = resolveProductName(
  process.env.NEXT_PUBLIC_OD_UI_PRODUCT_NAME,
);

// Do not rewrite technical identifiers such as OpenDesignHost,
// OpenDesignComponent, or @OpenDesignHQ. Only standalone legacy product names
// are UI branding and safe to replace.
const LEGACY_PRODUCT_NAME = /(?:Open\s+Design|OpenDesign)(?![A-Za-z0-9_])/g;

export function brandProductText(value: string): string {
  return value
    .replaceAll('{productName}', PRODUCT_NAME)
    .replace(LEGACY_PRODUCT_NAME, PRODUCT_NAME);
}
