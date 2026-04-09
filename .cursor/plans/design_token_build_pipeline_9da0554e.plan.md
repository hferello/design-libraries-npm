---
name: Design Token Build Pipeline
overview: Build a Style Dictionary v4 pipeline that transforms Figma-exported DTCG token JSON files into alias-preserving CSS custom properties (with light/dark theming and responsive overrides) and a Tailwind v4 @theme configuration, published as an npm package.
todos:
  - id: project-setup
    content: Create package.json (with exports field for npm package), tsconfig.json, npm scripts, install style-dictionary v4 + typescript + tsx
    status: pending
  - id: preprocessor
    content: "Build Figma colour object preprocessor: flatten hex/rgba, preserve $extensions.aliasData for alias resolution"
    status: pending
  - id: token-names
    content: "Create static name mappings in token-names.ts: 11 spacing aliases, font size aliases (text-* namespace), grid spatial names (spacing-grid-* namespace), and the Figma variable path to primitive CSS var name mapping"
    status: pending
  - id: transforms
    content: "Build transforms: name (kebab + static mapping + namespace routing using Tailwind v4 namespaces), value (px units via scope/path, opacity /100), alias (aliasData.targetVariableName to var() reference). Scopes: GAP, CORNER_RADIUS, STROKE_FLOAT, EFFECT_FLOAT, FONT_SIZE -> px. Scopeless grid spatial tokens -> px via path."
    status: pending
  - id: format-primitives
    content: "Build primitives.css format: :root with raw palette (including transparent black/white overlays), number scale"
    status: pending
  - id: format-tokens
    content: "Build tokens.css format: :root semantic vars (spacing, spacing-grid-*, radius, blur, opacity, text-*, grid-columns, border-*, surface, fg, icon, overlay), .dark overrides, range-based @media breakpoints"
    status: pending
  - id: format-tailwind
    content: "Build tailwind-theme.css format: @import tailwindcss + primitives.css, @theme static block for namespace-valid tokens only (--spacing-*, --text-*, --color-*, --radius-*, --blur-*), then :root block for non-namespace tokens (--opacity-*, --border-*, --grid-columns), .dark and range-based @media blocks OUTSIDE @theme"
    status: pending
  - id: sd-config
    content: "Wire SD config: source file loading with layer/mode/breakpoint metadata, preprocessor, transforms, 3 format outputs"
    status: pending
  - id: build-entry
    content: Create build/index.ts CLI entry with --library and --all flags, source directory resolution mapping
    status: pending
  - id: verify
    content: "Build verification script with assertions: alias accuracy, dark scoping, responsive scoping (range-based), opacity normalisation, overlay theming, no orphan var refs, @theme namespace validity (only --spacing-*, --text-*, --color-*, --radius-*, --blur-* inside @theme), no self-reference"
    status: pending
isProject: false
---

# Design Token Build Pipeline (v2)

## Architecture

```mermaid
flowchart LR
  subgraph source [Source: 10 DTCG JSON Files]
    Primitives["Primatives.tokens.json"]
    Sizes["Sizes.tokens.json"]
    Effects["Effects.tokens.json"]
    SpacingPos["Spacing.Positive.tokens.json"]
    SpacingNeg["Spacing.Negative.tokens.json"]
    Light["Colours.Light.tokens.json"]
    Dark["Colours.Dark.tokens.json"]
    Desktop["Responsive.Desktop.tokens.json"]
    Tablet["Responsive.Tablet.tokens.json"]
    Mobile["Responsive.Mobile.tokens.json"]
  end

  subgraph sd [Style Dictionary v4]
    Pre["Preprocessor\n1. Flatten color objects to hex/rgba\n2. Preserve aliasData for var refs"]
    NameT["Name Transform\npath to kebab + static mappings"]
    ValT["Value Transform\nunits + opacity normalisation"]
    AliasT["Alias Transform\naliasData to var reference"]
    Format["Formats\nprimitives.css, tokens.css, tailwind-theme.css"]
  end

  subgraph output [dist/typographic-ratio/]
    PrimCSS["primitives.css\n:root raw palette"]
    TokensCSS["tokens.css\n:root semantic + .dark + @media"]
    TailwindCSS["tailwind-theme.css\n@theme block"]
  end

  source --> Pre --> NameT --> ValT --> AliasT --> Format --> output
```

## Resolved Design Decisions

### 1. Alias preservation via `$extensions.aliasData`

Every semantic token carries `com.figma.aliasData.targetVariableName`, which is the only surviving alias link. The preprocessor MUST preserve this metadata. The alias transform converts it to a `var()` reference pointing at the primitive layer.

```
Source: Spacing.Positive > "Tightly related, one unit"
  $value: 4
  aliasData.targetVariableName: "Number/Positive/75"

Output: --spacing-tight: var(--primitive-number-75); /* 4px */
```

```
Source: Colours.Light > Colour.Neutral.Base
  $value: { hex: "#FFFFFF" }
  aliasData.targetVariableName: "Color/Neutral/0"

Output: --color-neutral-base: var(--primitive-color-neutral-0); /* #FFFFFF */
```

The `targetVariableName` path maps to a primitive CSS variable using a deterministic transform: `"Color/Neutral/0"` becomes `--primitive-color-neutral-0`, `"Number/Positive/75"` becomes `--primitive-number-75`.

### 2. Opacity: two distinct token types

**Numeric opacity** (`Effects.tokens.json` > `Opacity`): 5 tokens scoped to OPACITY. Raw values are 0-100 scale from the design system's number primitives. Normalize to 0-1 for CSS.

| Source name | Raw value | CSS output |
|---|---|---|
| Full | 100 | `--opacity-full: 1` |
| High | 36 | `--opacity-high: 0.36` |
| Medium | 16 | `--opacity-medium: 0.16` |
| Low | 8 | `--opacity-low: 0.08` |
| Faint | 2 | `--opacity-faint: 0.02` |

Alias preservation: `High` aliases `Number/Positive/700` (raw value 36). Output as `--opacity-high: calc(var(--primitive-number-700) / 100)`.

**Important**: Tailwind v4 has NO `--opacity-*` theme namespace. These tokens are plain `:root` CSS variables, NOT inside `@theme`. Engineers access them via `var(--opacity-high)` or Tailwind arbitrary values like `opacity-[var(--opacity-high)]`.

**Overlay colors** (`Colours.Light/Dark.tokens.json` > `Effects.Opacity`): 10 color tokens. In light mode: `#1A1A1A` at varying alpha. In dark mode: `#FFFFFF` at varying alpha. These are scrim/overlay fills, NOT the `opacity` CSS property.

Output as `--color-overlay-{pct}` (e.g., `--color-overlay-8`, `--color-overlay-36`). These go in `tokens.css` with dark overrides, registered in `@theme` as `--color-overlay-*` (under the `--color-*` namespace). Tailwind class: `bg-overlay-8`.

### 3. Color namespace for Tailwind

All color tokens live under `--color-*` in `@theme`. Tailwind v4 auto-generates `text-*`, `bg-*`, `border-*`, etc. from each.

| Figma category | CSS variable pattern | Tailwind examples |
|---|---|---|
| `Colour.Neutral.{level}` | `--color-neutral-{level}` | `bg-neutral-base`, `border-neutral-subtle` |
| `Colour.{Hue}.{level}` | `--color-{hue}-{level}` | `bg-blue-faint`, `bg-red-base` |
| `Colour.Font.Neutral.{level}` | `--color-fg-neutral-{level}` | `text-fg-neutral-aa`, `text-fg-neutral-dark` |
| `Colour.Font.{Hue}.{level}` | `--color-fg-{hue}-{level}` | `text-fg-blue-aa`, `text-fg-red-subtle` |
| `Colour.Icon.{name}` | `--color-icon-{name}` | `text-icon-blue`, `fill-icon-subtle` |
| `Effects.Opacity.{pct}` | `--color-overlay-{pct}` | `bg-overlay-8`, `bg-overlay-36` |

The `fg-` prefix is short, collision-free, and avoids the `text-text-*` doubling the review flagged. The `icon-` namespace keeps icon colors separate from text foreground colors because they intentionally differ in dark mode.

### 4. Tailwind v4 theme namespace mapping

Source: [tailwindcss.com/docs/theme](https://tailwindcss.com/docs/theme) (v4.2). Only variables matching a documented namespace generate utility classes. All others must live as plain `:root` CSS variables.

**Inside `@theme static`** (generates utilities):

| Token category | CSS variable namespace | Example utility |
|---|---|---|
| Spacing (11 values) | `--spacing-*` | `p-tight`, `gap-section` |
| Grid spatial (margin, gutter, vertical) | `--spacing-grid-*` | `gap-grid-gutter`, `p-grid-margin` |
| Font sizes (7 values) | `--text-*` | `text-xs`, `text-2xl` |
| Border radius (6 values) | `--radius-*` | `rounded-soft`, `rounded-pill` |
| Blur (4 values) | `--blur-*` | `blur-soft`, `blur-void` |
| All colours (surface, fg, icon, overlay) | `--color-*` | `bg-neutral-base`, `text-fg-neutral-aa` |

**Outside `@theme`** (plain `:root` CSS vars, no auto-generated utilities):

| Token category | CSS variable | How to use in Tailwind |
|---|---|---|
| Grid columns | `--grid-columns` | `grid-cols-[var(--grid-columns)]` |
| Border weight (4 values) | `--border-*` | `border-[length:var(--border-hairline)]` |
| Opacity (5 values) | `--opacity-*` | `opacity-[var(--opacity-high)]` |

Using `@theme static` ensures all CSS variables are always generated even when no HTML utility references them. This is correct for a shared library where consuming projects reference tokens in custom CSS before adding utility classes.

### 5. npm package structure

This repo publishes as `@hal/design-tokens`. The `package.json` exports field points to dist files:

```json
{
  "name": "@hal/design-tokens",
  "exports": {
    "./typographic-ratio/primitives.css": "./dist/typographic-ratio/primitives.css",
    "./typographic-ratio/tokens.css": "./dist/typographic-ratio/tokens.css",
    "./typographic-ratio/tailwind-theme.css": "./dist/typographic-ratio/tailwind-theme.css",
    "./golden-ratio/*": "./dist/golden-ratio/*",
    "./base-10-ratio/*": "./dist/base-10-ratio/*"
  }
}
```

Consumer imports:

```css
/* app/globals.css in a Next.js project */
@import "@hal/design-tokens/typographic-ratio/tailwind-theme.css";
```

### 6. Source directory resolution

Explicit mapping from CLI shorthand to actual directory names (with their quirks):

| CLI input | Source directory | Output slug |
|---|---|---|
| `typographic` | `Typographic ratio \u2013 Design Library by Hal` | `typographic-ratio` |
| `golden` | `Golden Ratio \u2013 Design Library by Hal` | `golden-ratio` |
| `base10` | `Base 10 ratio \u2013 Design Library by Hal` | `base-10-ratio` |

Known source-file quirks handled in transforms (not "fixed" in source):
- Filename: `Primatives.tokens.json` (typo, kept as-is)
- Primitive path: `Color/Neutral/Tranparent blacks/100` (typo in "Transparent", normalised in output to `--primitive-color-neutral-transparent-black-100`)

### 7. Verification strategy

Replace "spot-check" with a test script (`build/verify.ts`) that:

- Builds all 3 libraries programmatically
- For each, reads the 3 output CSS files and runs assertions:
  - **Alias accuracy**: For a sample of tokens, verify the `var(--primitive-*)` reference resolves to the correct value (cross-check aliasData.targetVariableName against Primatives.tokens.json)
  - **Dark mode scoping**: Assert dark-mode overrides appear inside `.dark, [data-theme="dark"] { }` and NOT in `:root`
  - **Responsive scoping**: Assert tablet overrides are inside `@media (min-width: 768px) and (max-width: 1199px)` and mobile inside `@media (max-width: 767px)`
  - **Opacity normalisation**: Assert `--opacity-full: 1`, `--opacity-low: 0.08`, etc.
  - **Overlay theming**: Assert `--color-overlay-8` value differs between `:root` (dark base) and `.dark` (light base)
  - **No orphan primitives**: Every `var(--primitive-*)` referenced in tokens.css exists in primitives.css
  - **Tailwind @theme namespace validity**: Every variable inside `@theme static` uses a documented Tailwind v4 namespace (`--spacing-*`, `--text-*`, `--color-*`, `--radius-*`, `--blur-*`). Variables like `--opacity-*`, `--border-*`, `--grid-columns` must NOT appear inside `@theme`.
  - **Non-theme completeness**: Every non-namespace token from `tokens.css` appears in the `:root` block of `tailwind-theme.css` (outside `@theme`)
  - **No self-reference**: Assert that no `@theme` entry references itself (e.g., `--spacing-tight: var(--spacing-tight)` must not occur)
  - **Range-based media queries**: Tablet override uses `(min-width: 768px) and (max-width: 1199px)`, mobile uses `(max-width: 767px)`. No cascading overlap between breakpoints.

---

## Output File Specifications

### `primitives.css`

```css
:root {
  /* Number scale (0, 25, 50, 75, 100, 200..1200, Infinite) */
  --primitive-number-0: 0;
  --primitive-number-25: 1;
  --primitive-number-50: 2;
  --primitive-number-75: 4;
  /* ... through 1200 (value 144) */
  --primitive-number-1200: 144;
  --primitive-number-infinite: 9999;

  /* Color palette */
  --primitive-color-neutral-0: #FFFFFF;
  --primitive-color-neutral-50: #FCFCFC;
  /* ... all hues, all steps */

  /* Transparent overlays (light set: blacks) */
  --primitive-color-neutral-transparent-black-0: rgba(26, 26, 26, 0);
  --primitive-color-neutral-transparent-black-100: rgba(26, 26, 26, 0.08);
  /* ... */

  /* Transparent overlays (dark set: whites) */
  --primitive-color-neutral-transparent-white-0: rgba(255, 255, 255, 0);
  --primitive-color-neutral-transparent-white-100: rgba(255, 255, 255, 0.08);
  /* ... */
}
```

### `tokens.css`

This file is a standalone semantic layer for non-Tailwind consumers. It imports `primitives.css` and defines every semantic variable in `:root`, with `.dark` and `@media` overrides. It is an ALTERNATIVE to `tailwind-theme.css`, not stacked with it.

```css
@import "./primitives.css";

:root {
  /* Spacing (11 values) */
  --spacing-flush: var(--primitive-number-0);          /* 0px */
  --spacing-tight: var(--primitive-number-75);          /* 4px */
  --spacing-paired: var(--primitive-number-100);        /* 8px */
  --spacing-grouped: var(--primitive-number-400);       /* 16px */
  --spacing-loose: var(--primitive-number-600);         /* 24px */
  --spacing-section: var(--primitive-number-700);       /* 36px */
  --spacing-independent: var(--primitive-number-700);   /* 36px */
  --spacing-region: var(--primitive-number-800);        /* 48px */
  --spacing-zone: var(--primitive-number-900);          /* 60px */
  --spacing-divide: var(--primitive-number-1000);       /* 72px */
  --spacing-apart: var(--primitive-number-1200);        /* 144px */

  /* Border radius (6 values) */
  --radius-sharp: var(--primitive-number-0);            /* 0px */
  --radius-subtle: var(--primitive-number-75);          /* 4px */
  --radius-soft: var(--primitive-number-100);           /* 8px */
  --radius-rounded: var(--primitive-number-300);        /* 14px */
  --radius-pill: var(--primitive-number-700);           /* 36px */
  --radius-circular: var(--primitive-number-infinite);  /* 9999px */

  /* Border weight (4 values) */
  --border-hairline: var(--primitive-number-25);        /* 1px */
  --border-defined: var(--primitive-number-50);         /* 2px */
  --border-bold: var(--primitive-number-75);            /* 4px */
  --border-graphic: var(--primitive-number-100);        /* 8px */

  /* Blur (4 values) */
  --blur-soft: var(--primitive-number-75);              /* 4px */
  --blur-hazy: var(--primitive-number-200);             /* 12px */
  --blur-foggy: var(--primitive-number-500);            /* 18px */
  --blur-void: var(--primitive-number-700);             /* 36px */

  /* Opacity (5 values, normalised 0-1) */
  --opacity-full: 1;                                              /* no alias, flat value */
  --opacity-high: calc(var(--primitive-number-700) / 100);        /* 0.36 */
  --opacity-medium: calc(var(--primitive-number-400) / 100);      /* 0.16 */
  --opacity-low: calc(var(--primitive-number-100) / 100);         /* 0.08 */
  --opacity-faint: calc(var(--primitive-number-50) / 100);        /* 0.02 */

  /* Font sizes — use --text-* to match Tailwind v4 namespace (desktop defaults) */
  --text-xs: var(--primitive-number-200);                /* 12px */
  --text-sm: var(--primitive-number-300);                /* 14px */
  --text-base: var(--primitive-number-500);              /* 18px */
  --text-md: var(--primitive-number-600);                /* 24px */
  --text-lg: var(--primitive-number-700);                /* 36px */
  --text-xl: var(--primitive-number-900);                /* 60px */
  --text-2xl: var(--primitive-number-1000);              /* 72px */

  /* Grid spatial — use --spacing-grid-* so Tailwind generates gap/padding utilities */
  --spacing-grid-margin: var(--primitive-number-100);    /* 8px */
  --spacing-grid-gutter: var(--primitive-number-200);    /* 12px */
  --spacing-grid-vertical-tight: var(--primitive-number-75);     /* 4px */
  --spacing-grid-vertical-default: var(--primitive-number-100);  /* 8px */
  --spacing-grid-vertical-loose: var(--primitive-number-200);    /* 12px */

  /* Grid columns — no Tailwind namespace, plain CSS var */
  --grid-columns: 12;                                   /* no alias, flat value */

  /* Surface colours (light default) */
  --color-neutral-base: var(--primitive-color-neutral-0);         /* #FFFFFF */
  --color-neutral-faint: var(--primitive-color-neutral-50);       /* #FCFCFC */
  --color-neutral-subtle: var(--primitive-color-neutral-100);     /* #F5F5F5 */
  --color-neutral-prominent: var(--primitive-color-neutral-400);  /* #7A7A7A */
  --color-neutral-strong: var(--primitive-color-neutral-600);     /* #3D3D3D */
  --color-neutral-deep: var(--primitive-color-neutral-800);       /* #030303 */
  /* ... + blue, green, orange, purple, red surfaces (same 6-level pattern) */

  /* Foreground colours (text, light default) */
  --color-fg-neutral-inverse: var(--primitive-color-neutral-0);   /* #FFFFFF */
  --color-fg-neutral-faint: var(--primitive-color-neutral-200);   /* #B8B8B8 */
  --color-fg-neutral-subtle: var(--primitive-color-neutral-300);  /* #999999 */
  --color-fg-neutral-aa-large: var(--primitive-color-neutral-400); /* #7A7A7A */
  --color-fg-neutral-aa: var(--primitive-color-neutral-500);      /* #5C5C5C */
  --color-fg-neutral-aaa: var(--primitive-color-neutral-600);     /* #3D3D3D */
  --color-fg-neutral-dark: var(--primitive-color-neutral-800);    /* #030303 */
  /* ... + blue, green, orange, purple, red foregrounds (same 7-level pattern) */

  /* Icon colours (light default) */
  --color-icon-subtle: var(--primitive-color-neutral-200);
  --color-icon-base: var(--primitive-color-neutral-600);
  --color-icon-bold: var(--primitive-color-neutral-800);
  --color-icon-inverse: var(--primitive-color-neutral-0);
  --color-icon-blue: var(--primitive-color-blue-500);
  --color-icon-green: var(--primitive-color-green-600);
  --color-icon-orange: var(--primitive-color-orange-500);
  --color-icon-purple: var(--primitive-color-purple-500);
  --color-icon-red: var(--primitive-color-red-500);

  /* Overlay colours (light: transparent blacks) */
  --color-overlay-0: var(--primitive-color-neutral-transparent-black-0);
  --color-overlay-8: var(--primitive-color-neutral-transparent-black-100);
  --color-overlay-12: var(--primitive-color-neutral-transparent-black-200);
  --color-overlay-16: var(--primitive-color-neutral-transparent-black-300);
  --color-overlay-24: var(--primitive-color-neutral-transparent-black-400);
  --color-overlay-36: var(--primitive-color-neutral-transparent-black-500);
  --color-overlay-48: var(--primitive-color-neutral-transparent-black-600);
  --color-overlay-60: var(--primitive-color-neutral-transparent-black-700);
  --color-overlay-72: var(--primitive-color-neutral-transparent-black-800);
  --color-overlay-96: var(--primitive-color-neutral-transparent-black-900);
}

.dark,
[data-theme="dark"] {
  /* Only colour variables are overridden here. Spacing, radius, blur,
     opacity, font sizes, and grid are theme-independent. */

  --color-neutral-base: var(--primitive-color-neutral-800);
  --color-neutral-faint: var(--primitive-color-neutral-700);
  --color-neutral-subtle: var(--primitive-color-neutral-600);
  --color-neutral-prominent: var(--primitive-color-neutral-200);
  --color-neutral-strong: var(--primitive-color-neutral-100);
  --color-neutral-deep: var(--primitive-color-neutral-50);
  /* ... + hue surfaces flipped the same way */

  --color-fg-neutral-inverse: var(--primitive-color-neutral-800);
  --color-fg-neutral-faint: var(--primitive-color-neutral-600);
  --color-fg-neutral-subtle: var(--primitive-color-neutral-500);
  --color-fg-neutral-aa-large: var(--primitive-color-neutral-200);
  --color-fg-neutral-aa: var(--primitive-color-neutral-100);
  --color-fg-neutral-aaa: var(--primitive-color-neutral-50);
  --color-fg-neutral-dark: var(--primitive-color-neutral-0);
  /* ... + hue foregrounds flipped */

  --color-icon-subtle: var(--primitive-color-neutral-600);
  --color-icon-base: var(--primitive-color-neutral-100);
  --color-icon-bold: var(--primitive-color-neutral-50);
  --color-icon-inverse: var(--primitive-color-neutral-850);
  --color-icon-blue: var(--primitive-color-blue-500);
  --color-icon-green: var(--primitive-color-green-500);
  --color-icon-orange: var(--primitive-color-orange-500);
  --color-icon-purple: var(--primitive-color-purple-500);
  --color-icon-red: var(--primitive-color-red-500);

  --color-overlay-0: var(--primitive-color-neutral-transparent-white-0);
  --color-overlay-8: var(--primitive-color-neutral-transparent-white-100);
  --color-overlay-12: var(--primitive-color-neutral-transparent-white-200);
  --color-overlay-16: var(--primitive-color-neutral-transparent-white-300);
  --color-overlay-24: var(--primitive-color-neutral-transparent-white-400);
  --color-overlay-36: var(--primitive-color-neutral-transparent-white-500);
  --color-overlay-48: var(--primitive-color-neutral-transparent-white-600);
  --color-overlay-60: var(--primitive-color-neutral-transparent-white-700);
  --color-overlay-72: var(--primitive-color-neutral-transparent-white-800);
  --color-overlay-96: var(--primitive-color-neutral-transparent-white-900);
}

/* Tablet: range-based so overrides don't cascade to mobile */
@media (min-width: 768px) and (max-width: 1199px) {
  :root {
    --text-2xl: var(--primitive-number-900);                       /* 72 -> 60 */
    --grid-columns: 8;                                             /* 12 -> 8 */
    --spacing-grid-vertical-tight: var(--primitive-number-50);     /* 4 -> 2 */
  }
}

/* Mobile: independent overrides vs desktop (Small unchanged, all others shift) */
@media (max-width: 767px) {
  :root {
    --text-xs: var(--primitive-number-100);                /* 12 -> 8 */
    --text-base: var(--primitive-number-400);              /* 18 -> 16 */
    --text-md: var(--primitive-number-500);                /* 24 -> 18 */
    --text-lg: var(--primitive-number-600);                /* 36 -> 24 */
    --text-xl: var(--primitive-number-800);                /* 60 -> 48 */
    --text-2xl: var(--primitive-number-900);               /* 72 -> 60 */
    --grid-columns: 2;                                     /* 12 -> 2 */
  }
}
```

### `tailwind-theme.css`

This file is the Tailwind v4 entry point. It is an ALTERNATIVE to `tokens.css`, not stacked on top of it. It imports `tailwindcss` and `primitives.css`.

**Structure**: The file has three distinct zones:
1. `@theme static { }` — tokens that match a documented Tailwind v4 namespace. These generate utility classes AND `:root` CSS variables. Uses `static` to ensure all variables are emitted even when unused in HTML (essential for a shared library).
2. `:root { }` — tokens with no Tailwind namespace (opacity, border weight, grid columns). Available via `var()` only, no auto-generated utilities.
3. Plain CSS blocks — `.dark` overrides and range-based `@media` breakpoints.

Why `@theme static` and not `@theme`: a design token library must guarantee all CSS variables exist regardless of which utility classes the consuming HTML happens to use. Without `static`, Tailwind tree-shakes unused theme variables from the CSS output.

```css
@import "tailwindcss";
@import "./primitives.css";

/* ── Zone 1: Namespace-valid tokens (generate utilities) ── */
@theme static {
  /* Spacing (--spacing-* namespace → p-*, m-*, gap-*, w-*, h-* utilities) */
  --spacing-flush: var(--primitive-number-0);
  --spacing-tight: var(--primitive-number-75);
  --spacing-paired: var(--primitive-number-100);
  --spacing-grouped: var(--primitive-number-400);
  --spacing-loose: var(--primitive-number-600);
  --spacing-section: var(--primitive-number-700);
  --spacing-independent: var(--primitive-number-700);
  --spacing-region: var(--primitive-number-800);
  --spacing-zone: var(--primitive-number-900);
  --spacing-divide: var(--primitive-number-1000);
  --spacing-apart: var(--primitive-number-1200);

  /* Grid spatial (--spacing-* namespace → gap-grid-gutter, p-grid-margin, etc.) */
  --spacing-grid-margin: var(--primitive-number-100);
  --spacing-grid-gutter: var(--primitive-number-200);
  --spacing-grid-vertical-tight: var(--primitive-number-75);
  --spacing-grid-vertical-default: var(--primitive-number-100);
  --spacing-grid-vertical-loose: var(--primitive-number-200);

  /* Font sizes (--text-* namespace → text-xs, text-2xl utilities) */
  --text-xs: var(--primitive-number-200);
  --text-sm: var(--primitive-number-300);
  --text-base: var(--primitive-number-500);
  --text-md: var(--primitive-number-600);
  --text-lg: var(--primitive-number-700);
  --text-xl: var(--primitive-number-900);
  --text-2xl: var(--primitive-number-1000);

  /* Border radius (--radius-* namespace → rounded-soft, rounded-pill utilities) */
  --radius-sharp: var(--primitive-number-0);
  --radius-subtle: var(--primitive-number-75);
  --radius-soft: var(--primitive-number-100);
  --radius-rounded: var(--primitive-number-300);
  --radius-pill: var(--primitive-number-700);
  --radius-circular: var(--primitive-number-infinite);

  /* Blur (--blur-* namespace → blur-soft, blur-void utilities) */
  --blur-soft: var(--primitive-number-75);
  --blur-hazy: var(--primitive-number-200);
  --blur-foggy: var(--primitive-number-500);
  --blur-void: var(--primitive-number-700);

  /* Surface colours (--color-* namespace → bg-neutral-base, border-neutral-subtle, etc.) */
  --color-neutral-base: var(--primitive-color-neutral-0);
  --color-neutral-faint: var(--primitive-color-neutral-50);
  --color-neutral-subtle: var(--primitive-color-neutral-100);
  --color-neutral-prominent: var(--primitive-color-neutral-400);
  --color-neutral-strong: var(--primitive-color-neutral-600);
  --color-neutral-deep: var(--primitive-color-neutral-800);
  /* ... + blue, green, orange, purple, red surfaces */

  /* Foreground colours (--color-* namespace → text-fg-neutral-aa, etc.) */
  --color-fg-neutral-inverse: var(--primitive-color-neutral-0);
  --color-fg-neutral-faint: var(--primitive-color-neutral-200);
  --color-fg-neutral-subtle: var(--primitive-color-neutral-300);
  --color-fg-neutral-aa-large: var(--primitive-color-neutral-400);
  --color-fg-neutral-aa: var(--primitive-color-neutral-500);
  --color-fg-neutral-aaa: var(--primitive-color-neutral-600);
  --color-fg-neutral-dark: var(--primitive-color-neutral-800);
  /* ... + hue foregrounds */

  /* Icon colours (--color-* namespace → text-icon-blue, fill-icon-subtle, etc.) */
  --color-icon-subtle: var(--primitive-color-neutral-200);
  --color-icon-base: var(--primitive-color-neutral-600);
  --color-icon-bold: var(--primitive-color-neutral-800);
  --color-icon-inverse: var(--primitive-color-neutral-0);
  --color-icon-blue: var(--primitive-color-blue-500);
  --color-icon-green: var(--primitive-color-green-600);
  --color-icon-orange: var(--primitive-color-orange-500);
  --color-icon-purple: var(--primitive-color-purple-500);
  --color-icon-red: var(--primitive-color-red-500);

  /* Overlay colours (--color-* namespace → bg-overlay-8, bg-overlay-36, etc.) */
  --color-overlay-0: var(--primitive-color-neutral-transparent-black-0);
  --color-overlay-8: var(--primitive-color-neutral-transparent-black-100);
  --color-overlay-12: var(--primitive-color-neutral-transparent-black-200);
  --color-overlay-16: var(--primitive-color-neutral-transparent-black-300);
  --color-overlay-24: var(--primitive-color-neutral-transparent-black-400);
  --color-overlay-36: var(--primitive-color-neutral-transparent-black-500);
  --color-overlay-48: var(--primitive-color-neutral-transparent-black-600);
  --color-overlay-60: var(--primitive-color-neutral-transparent-black-700);
  --color-overlay-72: var(--primitive-color-neutral-transparent-black-800);
  --color-overlay-96: var(--primitive-color-neutral-transparent-black-900);
}

/* ── Zone 2: Non-namespace tokens (no Tailwind utilities, var() only) ── */
:root {
  /* Grid columns — no Tailwind namespace; use grid-cols-[var(--grid-columns)] */
  --grid-columns: 12;

  /* Border weight — no Tailwind namespace; use border-[length:var(--border-hairline)] */
  --border-hairline: var(--primitive-number-25);          /* 1px */
  --border-defined: var(--primitive-number-50);            /* 2px */
  --border-bold: var(--primitive-number-75);               /* 4px */
  --border-graphic: var(--primitive-number-100);           /* 8px */

  /* Opacity — no Tailwind namespace; use opacity-[var(--opacity-high)] */
  --opacity-full: 1;
  --opacity-high: calc(var(--primitive-number-700) / 100);
  --opacity-medium: calc(var(--primitive-number-400) / 100);
  --opacity-low: calc(var(--primitive-number-100) / 100);
  --opacity-faint: calc(var(--primitive-number-50) / 100);
}

/* ── Zone 3: Dark overrides (plain CSS, OUTSIDE @theme) ── */
.dark,
[data-theme="dark"] {
  --color-neutral-base: var(--primitive-color-neutral-800);
  --color-neutral-faint: var(--primitive-color-neutral-700);
  --color-neutral-subtle: var(--primitive-color-neutral-600);
  --color-neutral-prominent: var(--primitive-color-neutral-200);
  --color-neutral-strong: var(--primitive-color-neutral-100);
  --color-neutral-deep: var(--primitive-color-neutral-50);
  /* ... + hue surfaces, fg, icon, overlay — identical to tokens.css .dark block */
}

/* ── Zone 3: Responsive overrides (range-based, OUTSIDE @theme) ── */
@media (min-width: 768px) and (max-width: 1199px) {
  :root {
    --text-2xl: var(--primitive-number-900);                       /* 72 -> 60 */
    --grid-columns: 8;                                             /* 12 -> 8 */
    --spacing-grid-vertical-tight: var(--primitive-number-50);     /* 4 -> 2 */
  }
}

@media (max-width: 767px) {
  :root {
    --text-xs: var(--primitive-number-100);                /* 12 -> 8 */
    --text-base: var(--primitive-number-400);              /* 18 -> 16 */
    --text-md: var(--primitive-number-500);                /* 24 -> 18 */
    --text-lg: var(--primitive-number-600);                /* 36 -> 24 */
    --text-xl: var(--primitive-number-800);                /* 60 -> 48 */
    --text-2xl: var(--primitive-number-900);               /* 72 -> 60 */
    --grid-columns: 2;                                     /* 12 -> 2 */
  }
}
```

## File Structure

```
design-libraries/
  package.json            # @hal/design-tokens, exports field
  tsconfig.json           # ESNext/NodeNext
  build/
    index.ts              # CLI entry: parse --library arg, run SD
    config.ts             # SD config factory (sources, platforms)
    preprocessors.ts      # Flatten Figma color objects, preserve aliasData
    transforms.ts         # name/kebab, value/units, alias/var-ref
    formats.ts            # primitives.css, tokens.css, tailwind-theme.css
    token-names.ts        # Static mappings (spacing aliases, etc.)
    verify.ts             # Assertion-based verification script
  dist/                   # Generated (gitignored, built before publish)
    typographic-ratio/
    golden-ratio/
    base-10-ratio/
```

## Implementation Steps

### Step 1: Project scaffolding
- `package.json` with `style-dictionary@^4`, `typescript`, `tsx`
- `tsconfig.json` targeting ESNext/NodeNext
- npm scripts: `"build": "tsx build/index.ts"`, `"build:all": "tsx build/index.ts --all"`, `"verify": "tsx build/verify.ts"`
- `.gitignore` for `dist/`

### Step 2: Preprocessor (`build/preprocessors.ts`)
- Walk token tree recursively
- When `$type === "color"` and `$value` is an object with `hex` and `alpha`:
  - If `alpha < 1`: replace `$value` with `rgba(r, g, b, alpha)` (compute from `components` + `alpha`)
  - If `alpha === 1`: replace `$value` with the `hex` string
- **Keep** `$extensions` intact (needed for alias resolution in step 3)

### Step 3: Transforms (`build/transforms.ts`)

**Name transform**: Convert SD token path to kebab-case CSS var name. Apply static mappings from `token-names.ts` for spacing and font size tokens. Route tokens into correct Tailwind v4 namespaces:
- `Primatives > Color > Neutral > 0` becomes `--primitive-color-neutral-0`
- `Spacing > Positive > "Tightly related, one unit"` becomes `--spacing-tight`
- `Colour > Font > Neutral > AA` becomes `--color-fg-neutral-aa`
- `Colour > Neutral > Base` becomes `--color-neutral-base`
- `Colour > Icon > Blue` becomes `--color-icon-blue`
- `Colour > Effects > Opacity > 8%` becomes `--color-overlay-8`
- `Effects > Opacity > Full` becomes `--opacity-full` (no Tailwind namespace)
- `Effects > Blur > Soft` becomes `--blur-soft`
- `Sizes > Border Radius > Soft` becomes `--radius-soft`
- `Sizes > Border Weight > Hairline` becomes `--border-hairline` (no Tailwind namespace)
- `Responsive > Desktop > Font > XSmall` becomes `--text-xs` (Tailwind `--text-*` namespace)
- `Responsive > Desktop > Grid > Margin` becomes `--spacing-grid-margin` (Tailwind `--spacing-*` namespace)
- `Responsive > Desktop > Grid > Horizontal` becomes `--grid-columns` (no Tailwind namespace)

**Value transform for dimensions**: Add `px` unit based on Figma scope or token path:
- Scope-based: `GAP` (spacing), `CORNER_RADIUS`, `STROKE_FLOAT` (border weight), `EFFECT_FLOAT` (blur), `FONT_SIZE` → append `px`
- Path-based: `Grid/Margin`, `Grid/Gutter`, `Grid/Vertical/*` have no Figma scope but are spatial dimensions → append `px`
- Excluded: `WIDTH_HEIGHT` (responsive Width metadata and grid column count) → stays unitless or is not published

**Value transform for opacity**: Divide by 100 to normalise to 0-1.

**Alias transform**: Read `$extensions.com.figma.aliasData.targetVariableName`. Map the Figma variable path to the corresponding primitive CSS variable name:
- `"Number/Positive/75"` becomes `var(--primitive-number-75)`
- `"Color/Neutral/0"` becomes `var(--primitive-color-neutral-0)`
- `"Color/Neutral/Tranparent blacks/100"` becomes `var(--primitive-color-neutral-transparent-black-100)`
- Tokens without `aliasData` (e.g., `Opacity.Full`, `Border Radius.Sharp` which is 0) get flat values

### Step 4: Static name mappings (`build/token-names.ts`)

Spacing (11 positive values, complete):
- `"Flush"` -> `flush` (0px, Number/Positive/0)
- `"Tightly related, one unit"` -> `tight` (4px, Number/Positive/75)
- `"Clearly paired, slight breath"` -> `paired` (8px, Number/Positive/100)
- `"Same group, distinct items"` -> `grouped` (16px, Number/Positive/400)
- `"Loose group, breathing room"` -> `loose` (24px, Number/Positive/600)
- `"Distinct sections, clear gap"` -> `section` (36px, Number/Positive/700)
- `"Independent, different context"` -> `independent` (36px, Number/Positive/700)
- `"New section"` -> `region` (48px, Number/Positive/800)
- `"Clear visual break between zones"` -> `zone` (60px, Number/Positive/900)
- `"Unrelated, structural separation"` -> `divide` (72px, Number/Positive/1000)
- `"Very far apart"` -> `apart` (144px, Number/Positive/1200)

Note: `section` and `independent` both resolve to 36px (same primitive). Different semantic intent, same underlying value.

Font sizes (7 values, `--text-*` namespace):
- `XSmall` -> `xs` → `--text-xs`
- `Small` -> `sm` → `--text-sm`
- `Regular` -> `base` → `--text-base`
- `Medium` -> `md` → `--text-md`
- `Large` -> `lg` → `--text-lg`
- `XLarge` -> `xl` → `--text-xl`
- `XXLarge` -> `2xl` → `--text-2xl`

Grid spatial (5 values, `--spacing-grid-*` namespace):
- `Grid/Margin` → `--spacing-grid-margin`
- `Grid/Gutter` → `--spacing-grid-gutter`
- `Grid/Vertical/Tight` → `--spacing-grid-vertical-tight`
- `Grid/Vertical/Default` → `--spacing-grid-vertical-default`
- `Grid/Vertical/Loose` → `--spacing-grid-vertical-loose`

Grid columns (1 value, no Tailwind namespace):
- `Grid/Horizontal` → `--grid-columns`

Responsive `Width` tokens (Desktop=1200, Tablet=768, Mobile=375): these are NOT emitted as published tokens. They exist in the source as design metadata. The build pipeline uses the breakpoint boundaries hardcoded as `1199px` (tablet) and `767px` (mobile), derived from but not dynamically reading these Width values.

### Step 5: Formats (`build/formats.ts`)

Three custom SD format functions, each receiving the processed token dictionary and writing one output file:

- **Primitives format**: Emits `:root { }` with all primitive tokens (number scale 0..1200 + Infinite, full colour palette including transparent variants). Pure flat values, no `var()` references.
- **Tokens format**: Emits `@import "./primitives.css"` then `:root { }` with all semantic tokens using `var(--primitive-*)` references. Then `.dark` block with colour overrides. Then range-based `@media` blocks for tablet/mobile font and grid overrides. This file is a standalone entry point for non-Tailwind consumers.
- **Tailwind theme format**: Emits `@import "tailwindcss"` and `@import "./primitives.css"`, then three zones:
  1. `@theme static { }` — only tokens with a documented Tailwind v4 namespace (`--spacing-*`, `--text-*`, `--color-*`, `--radius-*`, `--blur-*`). These generate both CSS variables and utility classes.
  2. `:root { }` — tokens without a Tailwind namespace (`--opacity-*`, `--border-*`, `--grid-columns`). Available via `var()` only.
  3. Plain CSS — `.dark` overrides and range-based `@media` breakpoints.

Key: `tokens.css` and `tailwind-theme.css` are ALTERNATIVE entry points. They define the same variable names and both import `primitives.css`. They differ in structure: `tailwind-theme.css` splits namespace-valid tokens into `@theme static` to generate utilities, while non-namespace tokens go into a separate `:root` block.

### Step 6: SD config (`build/config.ts`)

- Accept library shorthand, resolve to source directory path
- Load all 10 source files, tag each with metadata: `{ layer: "primitive" | "semantic" | "theme", mode: "light" | "dark" | null, breakpoint: "desktop" | "tablet" | "mobile" | null }`
- Wire preprocessor, transforms (name, value, alias), and three format outputs

### Step 7: CLI entry (`build/index.ts`)

- Parse `--library` flag (default: `typographic`)
- Parse `--all` flag to build all three
- Instantiate SD, run build, log results

### Step 8: Verification (`build/verify.ts`)

- Build all 3 library variants
- Parse each output CSS file
- Run assertions per the verification strategy in section 7 above
- Exit non-zero on any failure