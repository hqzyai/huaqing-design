# shadcn UI compatibility layer

The existing `Button`, `Input`, and `Textarea` exports use the native-element
branches and visual states from the official shadcn/ui `new-york-v4` registry,
adapted to this package's React 18 and CSS Modules contract. They are customized
components, not unmodified upstream files. License: [LICENSE.shadcn](LICENSE.shadcn).

Sources inspected on 2026-10-12:

| Component | Official source | SHA-256 of retrieved registry JSON |
| --- | --- | --- |
| Button | https://ui.shadcn.com/r/styles/new-york-v4/button.json | `4b8d7d848742727973c1b088af8d15f0b628272a1316f2d2fa344e73ddff9e9c` |
| Input | https://ui.shadcn.com/r/styles/new-york-v4/input.json | `b1fffa12ba72ce30a291749012b47235eda110648b8106725ced22b5b31c8f1b` |
| Textarea | https://ui.shadcn.com/r/styles/new-york-v4/textarea.json | `2367d3964326b19ca2355f872d08153c86932abd4b103b5fd02039a3f2cb8ae5` |

## Preserved contracts

- Keep React 18 `forwardRef`, native events, uncontrolled values, form ownership,
  and the public props. `Button` still defaults to `type="button"`; migrated
  native buttons have an explicit type. Buttons with implicit submit semantics
  or unknown spread props remain native.
- Map existing `primary` to shadcn default, `default` to outline,
  `primary-ghost`/`subtle` to secondary, and `ghost` to ghost. Legacy classes stay
  available for existing domain styles and selectors.
- Translate the relevant utility styles to CSS Modules and the shared legacy
  stylesheet. Use the existing class-name helper; don't add Slot/CVA/Tailwind
  runtime dependencies for APIs this package does not expose.
- Preserve domain-owned control dimensions, active feedback, cursor, pointer
  events, and textarea resize/scroll behavior. Shared default sizing follows
  the visual profile without imposing a minimum over compact local controls.
  Do not adopt upstream `field-sizing`,
  automatic SVG resizing, or disabled pointer suppression.
- Keep the native `Select` contract (`multiple`, numeric `size`, native events,
  original DOM) rather than adopting NativeSelect's extra wrapper/size variant.
- Keep Dialog, custom select menus, editor, upload, terminal, preview, drag and
  virtualized behavior implementations; they consume the same theme but are
  not claimed to be official shadcn implementations.

## Theme ownership

The web app owns `styles/shadcn-tokens.css` (`shadcn-neutral-v3`). Existing app
tokens bridge to that palette so page-specific styles and retained controls
share the same surfaces. `--ui-*` avoids colliding with the persisted app
`--accent`, which represents an action color rather than shadcn's hover surface.
Existing custom accent, light-only appearance policy, brand/status semantics,
content/editor font settings, measured geometry and responsive breakpoints
remain in place. The profile is a project design standard, not an official
shadcn preset.

## V3 typography and visual roles

- Application Latin/numerals use Geist; Chinese uses Noto Sans SC; application
  code and logs use Geist Mono. Their normal variable faces are self-hosted
  under `apps/web/public/fonts/shadcn-v3`, using Fontsource packages pinned to
  Geist/Geist Mono 5.3.0 and Noto Sans SC 5.3.1. The original WOFF2 files and
  complete upstream unicode ranges are retained, including dynamic CJK text.
- `apps/web/src/runtime/font-assets.json` records package integrity, font
  SHA-256, descriptors and OFL license paths. `styles/fonts.css` declares the
  same subsets with `font-display: swap`; no runtime Google Fonts requests or
  eager preload of all Chinese subsets is required. The existing packaged
  font recovery now fetches only a failed subset, preserving its unicode range.
- `--ui-*-font-size`, `--ui-*-line-height` and weight roles replace page-local
  typography choices. Page/section/card titles are 28/36, 20/28 and 16/24 at
  weight 600; body is 14/22, control labels 14/20, captions 12/18, and app code
  13/20. Emphasis uses 500; UI text does not use synthesized bold.
- Controls use 6px corners, menus 8px, panels/cards 12px, and chips 4px. Avatars,
  status indicators and specialized native controls retain their distinct
  shapes. Shared hover/active/invalid/readonly/focus values come from the same
  semantic tokens; menu and dialog elevations are shared across retained
  implementations.
- Shared controls naturally reach the standard 36px height through line-height
  and padding. Local compact controls, resizable inputs and measured content
  keep their explicit dimensions instead of being enlarged by a global minimum.
  Floating-surface spacing is mapped to the shared spacing scale without
  changing the page grid, navigation order or scrolling containers.

### Compatibility boundaries

- Existing native Select, custom menu/Dialog state, portals, stacking constants,
  focus/close strategies, form callbacks, persistence and breakpoints stay with
  their current owners. Their themed appearance is not an official replacement
  of those behavior implementations.
- Terminal, Theater, canvas/preview engines, user font specimens and user-authored
  rich content retain their content geometry and formatting. Markdown keeps
  italic synthesis for user-authored emphasis, while UI bold uses real weights. Old font assets
  remain available for existing content/preview consumers. Locale-specific
  Japanese fallback families remain after the unified UI families.
- Brand graphics, semantic status indicators, template previews, rich-content
  bold/italic, existing material effects, and animations coupled to completion
  events are not globally normalized. The existing app accent preference is not
  overwritten. Portal z-index values are preserved because local absolute
  numbers from a theme cannot replace the existing stacking contracts.
- Compact close icons and measured navigation/toolbar controls retain their
  previous hit geometry. The workspace picker retains 16px text line-height
  so its title and metadata fit the existing measured 34px row; this migration does not claim every existing control
  meets the profile's 44px touch target. Reworking those interaction layouts is
  outside a behavior-preserving visual migration.

The CSS Module bases deliberately use `:where` so feature classes can still
control layout. Shared legacy primitives receive the same palette and states.
Future upstream updates must be reviewed against these contracts; do not use
CLI overwrite/reinstall on the existing components.

## Web integration scope

The initial migration covers 142 web TSX files: 1,123 explicitly typed buttons,
116 text-like inputs, and 35 textareas now consume these existing shared exports.
Only JSX component names and their imports changed at these call sites; their
props, handlers, hooks, content and conditions are preserved.

The migration deliberately retains 34 buttons with implicit types or spread
props and 78 specialized/native inputs in the inspected files. Checkboxes,
radios, ranges, file/color inputs, native selects, custom menus and dialogs keep
their original event and focus contracts. The Theater rendering surface and
specialized editor/preview engines also retain their implementations. Existing
theme-token consumers still receive the shared neutral palette.

The shared primitive tests exercise submit defaults, external form ownership,
FormData, uncontrolled drafts/reset, IME callbacks, refs and disabled actions.
Web regression tests keep the existing behavior assertions; markup assertions
allow the extra shared CSS Module class instead of relying on an exact class
attribute string.

## Lucide icon profile

The React web runtime now uses `lucide-outline-v1`, with the existing pinned
`lucide-react@1.16.0` package. `apps/web/src/components/lucide-icons.ts` uses
explicit named imports. `Icon` keeps the existing semantic keys and SVG props;
`RemixIcon` is a compatibility adapter for existing data-driven names, not a
second generic icon renderer. Unknown values retain their former null/empty
fallbacks. Business conditions, callbacks, navigation and persisted icon keys
are unchanged.

`LucideGlyph` supplies one presentation boundary: 16px controls, 20px navigation
and independent actions, 24px display icons, currentColor, and 1.75px strokes.
Its CSS Module uses `vector-effect: non-scaling-stroke` on Lucide geometry so
CSS-sized and compact slots keep the same visible stroke width. This avoids
passing the newer documentation's `nonScalingStroke` prop to the installed
release, which exposes `absoluteStrokeWidth` instead. Existing loading rhythms
stay on their original classes; reduced-motion disables the shared spin.

Native Selects retain native behavior and use the official ChevronDown path as
an embedded SVG background. This keeps `packages/components` React-only; no
Lucide runtime dependency is added to the shared primitive package. Complete
upstream license text accompanies each owning package as `LICENSE.lucide`.

Compatibility exceptions:

- Agent/editor/vendor logos and social platform marks retain their original
  assets. The app's two brand entry points use the separate profile below.
  Only brand paths remain in `brand-icon-paths.ts`.
- Inline chip checks/close controls, tab metadata and compact indicators with
  an existing 8–12px slot retain that footprint. Dynamic icon sizes in editor
  tiles and file-kind badges retain their owning geometry. The renderer and
  stroke presentation still use Lucide. This migration does not enlarge their
  hit areas or remeasure virtualized rows.
- FileSyncBadge's product-specified upload/download animations, MatrixLoader's
  dot animation, the Settings coachmark hand, brand illustrations, scenario
  thumbnails, drawing strokes and the radial menu geometry are specialized
  graphics, not generic UI icons; they retain their timing and rendering.
- Selected assistant feedback icons retain their existing filled state cue.
  Existing app/status foreground colors remain bound to their owning state.
- The imported Remix font stylesheet is no longer part of the app cascade.
  Legacy font files and the packaged font-recovery entry remain available for
  old content/packaged consumers; they are not used to render the app UI.
- The separate marketing/landing-page app and generated/user-authored content
  are outside this web-runtime migration.

## Web brand entry points

The user-selected `hqzy-logomark-v2` profile is applied to the React web runtime.
Both entry points share the same blue symbol; no wordmark is displayed:

| Entry | Asset in `apps/web/public/` | SHA-256 |
| --- | --- | --- |
| Next.js `app/layout.tsx` metadata favicon | `hqzyai-logomark.svg` | `720d90e26fcd94a1000c5a40cd2dd042c07299f5bae601ba7e3052330e534c52` |
| `WorkspaceTabsBar` Home/rail brand entry | `hqzyai-logomark.svg` | `720d90e26fcd94a1000c5a40cd2dd042c07299f5bae601ba7e3052330e534c52` |

This is a byte-identical copy of the user-provided SVG bundled with
`shadcn-ui-unify`, not shadcn/Lucide artwork; no open-source license is asserted.
The skill carries the complete SVG with its gradients and resolves it relative
to its own directory. The app uses its own public copy, with no runtime dependency
on the installed skill, the author's computer or an external image host.
It uses the app's existing root-relative public URL. The product name/title,
desktop icons, user-generated content and third-party marks remain unchanged.

The mark uses the profile's standard 28×28px image box within the existing
78px-wide Home slot. `object-fit: contain` preserves the SVG's 793:568 ratio
(about 28×20px of artwork), without cropping, recoloring or distortion.
`WorkspaceTabsBar.module.css` owns this presentation. The global
`workspace-chrome-logo` class remains only as the existing collapsed-rail hover
swap hook; the Lucide expand-sidebar icon still appears on hover. The same
image is used in active/inactive pinned tabs and the docked Home button, with
empty alt text because the parent already owns its accessible name. Navigation,
rail events, keyboard behavior and hit regions keep their existing contracts.
