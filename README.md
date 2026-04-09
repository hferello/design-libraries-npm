# @hferello/design-libraries-npm

Style Dictionary v4 pipeline that transforms Figma-exported DTCG token JSON files into alias-preserving CSS custom properties and a Tailwind v4 `@theme` configuration.

## Libraries

Three design libraries, each built from 10 Figma-exported `.tokens.json` source files:

| CLI shorthand | Source directory | Output |
|---|---|---|
| `typographic` | `libraries/typographic-ratio/` | `dist/typographic-ratio/` |
| `golden` | `libraries/golden-ratio/` | `dist/golden-ratio/` |
| `base10` | `libraries/base-10-ratio/` | `dist/base-10-ratio/` |

## Quick start

```bash
npm install
npm run build:all   # builds all 3 libraries
npm run verify      # builds + runs 116 assertions
```

Build a single library:

```bash
npm run build -- --library typographic
npm run build -- --library golden
npm run build -- --library base10
```

## Output files

Each library produces three CSS files in `dist/<library>/`:

### `primitives.css`

Raw palette values in `:root`. Number scale, all colour hues, transparent black/white overlays.

```css
:root {
  --primitive-number-0: 0;
  --primitive-number-75: 4;
  --primitive-color-neutral-0: #FFFFFF;
  --primitive-color-neutral-transparent-black-100: rgba(26, 26, 26, 0.08);
  /* ... */
}
```

### `tokens.css`

Semantic layer for non-Tailwind consumers. Imports `primitives.css` and defines every semantic variable with `var(--primitive-*)` alias references, `.dark` overrides, and range-based `@media` responsive breakpoints.

```css
@import "./primitives.css";

:root {
  --spacing-tight: var(--primitive-number-75);
  --radius-soft: var(--primitive-number-100);
  --opacity-high: calc(var(--primitive-number-700) / 100);
  --text-base: var(--primitive-number-500);
  --color-neutral-base: var(--primitive-color-neutral-0);
  --color-font-neutral-aa: var(--primitive-color-neutral-500);
  --color-overlay-8: var(--primitive-color-neutral-transparent-black-100);
  /* ... */
}

.dark,
[data-theme="dark"] {
  --color-neutral-base: var(--primitive-color-neutral-800);
  --color-overlay-8: var(--primitive-color-neutral-transparent-white-100);
  /* ... */
}

@media (min-width: 768px) and (max-width: 1199px) {
  :root { --text-2xl: var(--primitive-number-900); /* ... */ }
}

@media (max-width: 767px) {
  :root { --text-xs: var(--primitive-number-100); /* ... */ }
}
```

### `tailwind-theme.css`

Tailwind v4 entry point. Alternative to `tokens.css` (not stacked on top of it). Splits tokens into `@theme static` (generates utility classes) and `:root` (plain CSS variables).

```css
@import "tailwindcss";
@import "./primitives.css";

@theme static {
  --spacing-tight: var(--primitive-number-75);
  --text-base: var(--primitive-number-500);
  --radius-soft: var(--primitive-number-100);
  --blur-soft: var(--primitive-number-75);
  --color-neutral-base: var(--primitive-color-neutral-0);
  /* ... */
}

:root {
  --border-hairline: var(--primitive-number-25);
  --opacity-high: calc(var(--primitive-number-700) / 100);
  --grid-columns: 12;
}

.dark,
[data-theme="dark"] { /* ... */ }
@media (min-width: 768px) and (max-width: 1199px) { /* ... */ }
@media (max-width: 767px) { /* ... */ }
```

## Usage in a consuming project

```css
/* app/globals.css — Tailwind project */
@import "@hferello/design-libraries-npm/typographic-ratio/tailwind-theme.css";
```

```css
/* app/globals.css — non-Tailwind project */
@import "@hferello/design-libraries-npm/typographic-ratio/tokens.css";
```

Tailwind utility examples:

```html
<div class="p-tight gap-section rounded-soft blur-void">
  <p class="text-base text-font-neutral-aa bg-neutral-faint">Hello</p>
</div>
```

Non-namespace tokens require arbitrary value syntax:

```html
<div class="border-[length:var(--border-hairline)] opacity-[var(--opacity-high)]">
  ...
</div>
```

## Token namespaces

### Inside `@theme static` (generates utilities)

| Category | CSS namespace | Utility examples |
|---|---|---|
| Spacing (11 values) | `--spacing-*` | `p-tight`, `gap-section`, `m-apart` |
| Grid spatial | `--spacing-grid-*` | `gap-grid-gutter`, `p-grid-margin` |
| Font sizes (7 values) | `--text-*` | `text-xs`, `text-base`, `text-2xl` |
| Border radius (6 values) | `--radius-*` | `rounded-soft`, `rounded-pill` |
| Blur (4 values) | `--blur-*` | `blur-soft`, `blur-void` |
| All colours | `--color-*` | `bg-neutral-base`, `text-font-neutral-aa` |

### Outside `@theme` (plain CSS variables)

| Category | CSS variable | Access in Tailwind |
|---|---|---|
| Grid columns | `--grid-columns` | `grid-cols-[var(--grid-columns)]` |
| Border weight (4 values) | `--border-*` | `border-[length:var(--border-hairline)]` |
| Opacity (5 values) | `--opacity-*` | `opacity-[var(--opacity-high)]` |

## Pipeline architecture

```
Source (10 DTCG JSON files per library)
  │
  ├─ Primatives.tokens.json          → primitives
  ├─ Spacing.Positive.tokens.json    → semantic spacing
  ├─ Spacing.Negative.tokens.json    → (excluded, Figma-internal)
  ├─ Sizes.tokens.json               → border radius, border weight
  ├─ Effects.tokens.json             → blur, opacity
  ├─ Colours.Light.tokens.json       → light theme colours
  ├─ Colours.Dark.tokens.json        → dark theme colours
  ├─ Responsive.Desktop.tokens.json  → font sizes, grid (defaults)
  ├─ Responsive.Tablet.tokens.json   → tablet overrides
  └─ Responsive.Mobile.tokens.json   → mobile overrides
  │
  ▼
Style Dictionary v4
  │
  ├─ Parser        → namespace wrapping (prevents path collisions)
  ├─ Preprocessor  → flatten Figma colour objects to hex/rgba
  ├─ Name transform    → static mappings + namespace routing
  ├─ Value transform   → px units, opacity normalisation
  └─ Alias transform   → aliasData.targetVariableName → var()
  │
  ▼
Output (3 CSS files per library in dist/)
  │
  ├─ primitives.css
  ├─ tokens.css
  └─ tailwind-theme.css
```

## Build modules

| File | Purpose |
|---|---|
| `build/index.ts` | CLI entry point (`--library`, `--all`) |
| `build/config.ts` | SD v4 config factory, library resolution, parser registration |
| `build/namespaces.ts` | Namespace constants to prevent SD token path collisions |
| `build/preprocessors.ts` | Flatten Figma colour objects to hex/rgba strings |
| `build/transforms.ts` | Name, value, and alias transforms |
| `build/formats.ts` | Three CSS format outputs with partitioning |
| `build/token-names.ts` | Static name mappings and Tailwind namespace checker |
| `build/verify.ts` | 116 assertions across 10 verification categories |

## Verification

`npm run verify` builds all libraries and asserts:

1. **Alias accuracy** — `var(--primitive-*)` references point to correct primitives
2. **Dark mode scoping** — dark overrides inside `.dark` only
3. **Responsive scoping** — range-based media queries with correct breakpoints
4. **Opacity normalisation** — `--opacity-full: 1`, aliases use `calc(var()/100)`
5. **Overlay theming** — light uses transparent-black, dark uses transparent-white
6. **No orphan primitives** — every referenced primitive exists (source data gaps logged as warnings)
7. **@theme namespace validity** — only documented Tailwind v4 namespaces inside `@theme`
8. **Non-theme completeness** — all non-namespace tokens in tailwind `:root`
9. **No self-reference** — no `var(--foo)` in the definition of `--foo`
10. **Range-based media queries** — tablet uses min+max width, mobile uses max-width only
