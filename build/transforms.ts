/**
 * Style Dictionary v4 transforms for the design token pipeline.
 *
 * Three transforms:
 * 1. Name transform — strips parser namespace, applies static mappings + namespace routing
 * 2. Value transform — adds px units for dimensional tokens, normalises opacity to 0-1
 * 3. Alias transform — converts aliasData.targetVariableName to var(--primitive-*) references
 */

import type { TransformedToken, Config } from 'style-dictionary/types';
import {
  SPACING_NAME_MAP,
  FONT_SIZE_NAME_MAP,
  GRID_SPATIAL_NAME_MAP,
  GRID_COLUMNS_PATH,
  OPACITY_NAME_MAP,
  OVERLAY_NAME_MAP,
  RADIUS_NAME_MAP,
  BORDER_WEIGHT_NAME_MAP,
  BLUR_NAME_MAP,
} from './token-names.js';
import { ALL_NAMESPACES, NS } from './namespaces.js';

// ─── Helpers ───

function getScopes(token: TransformedToken): string[] {
  return (token.$extensions?.['com.figma.scopes'] as string[] | undefined) ?? [];
}

function getAliasData(token: TransformedToken): { targetVariableName?: string } | undefined {
  return token.$extensions?.['com.figma.aliasData'] as { targetVariableName?: string } | undefined;
}

/**
 * Strips the parser namespace prefix from a token path.
 * Returns the namespace identifier and the clean (Figma-original) path.
 */
function stripNamespace(raw_path: string[]): { ns: string | null; path: string[] } {
  if (raw_path.length > 0 && ALL_NAMESPACES.has(raw_path[0]!)) {
    return { ns: raw_path[0]!, path: raw_path.slice(1) };
  }
  return { ns: null, path: raw_path };
}

/**
 * Maps a Figma variable path (e.g. "Number/Positive/75", "Color/Neutral/0")
 * to a primitive CSS variable name (e.g. "--primitive-number-75", "--primitive-color-neutral-0").
 *
 * Handles the "Tranparent blacks/whites" typo from Figma source.
 * Strips "Positive" polarity for numbers; converts "Negative" to "neg".
 */
export function figmaPathToPrimitiveCssVar(figma_path: string): string {
  const segments = figma_path.split('/');

  // Number polarity handling:
  // "Number/Positive/75" → ["Number", "75"] (positive, strip polarity)
  // "Number/Negative/75" → ["Number", "neg", "75"] (negative, keep as "neg")
  if (segments[0] === 'Number' && segments[1] === 'Positive') {
    segments.splice(1, 1);
  } else if (segments[0] === 'Number' && segments[1] === 'Negative') {
    segments[1] = 'neg';
  }

  const normalised = segments
    .map(s => {
      if (s === 'Tranparent blacks') return 'transparent-black';
      if (s === 'Tranparent whites') return 'transparent-white';
      if (s === 'Tranparent') return 'transparent';
      if (s === 'Transparent') return 'transparent';
      return s;
    })
    .map(s => s.toLowerCase().replace(/\s+/g, '-'))
    .join('-');

  return `--primitive-${normalised}`;
}

// ─── Name Transform ───

/**
 * Determines the CSS variable name for a token based on its parser namespace,
 * clean path, and Figma scopes. Applies static mappings and namespace routing.
 */
export function nameTransform(token: TransformedToken, _config: Config): string {
  const { ns, path } = stripNamespace(token.path);
  const scopes = getScopes(token);

  // ── Primitive layer: all positive tokens get --primitive-* prefix
  if (ns === NS.PRIMITIVE) {
    // Negative numbers from the primitives file are not published
    if (path[0] === 'Number' && path[1] === 'Negative') {
      return '--_unpublished-neg-number';
    }
    return figmaPathToPrimitiveCssVar(path.join('/'));
  }

  // ── Negative spacing — not published (used internally in Figma only)
  if (ns === NS.SPACING_NEG) {
    return '--_unpublished-neg-spacing';
  }

  // ── Spacing (positive only — scoped to GAP)
  if (ns === NS.SPACING_POS && path.length === 1) {
    const figma_name = path[0] ?? '';
    const mapped = SPACING_NAME_MAP[figma_name];
    if (mapped) return `--spacing-${mapped}`;
  }

  // ── Sizes > Border > Radius
  if (path[0] === 'Border' && path[1] === 'Radius' && scopes.includes('CORNER_RADIUS')) {
    const name = path[2] ?? '';
    const mapped = RADIUS_NAME_MAP[name];
    if (mapped) return `--radius-${mapped}`;
  }

  // ── Sizes > Border > Weight
  if (path[0] === 'Border' && path[1] === 'Weight' && scopes.includes('STROKE_FLOAT')) {
    const name = path[2] ?? '';
    const mapped = BORDER_WEIGHT_NAME_MAP[name];
    if (mapped) return `--border-${mapped}`;
  }

  // ── Effects > Blur
  if (path[0] === 'Blur' && scopes.includes('EFFECT_FLOAT')) {
    const name = path[1] ?? '';
    const mapped = BLUR_NAME_MAP[name];
    if (mapped) return `--blur-${mapped}`;
  }

  // ── Effects > Opacity (numeric, not overlay colours)
  if (path[0] === 'Opacity' && scopes.includes('OPACITY')) {
    const name = path[1] ?? '';
    const mapped = OPACITY_NAME_MAP[name];
    if (mapped) return `--opacity-${mapped}`;
  }

  // ── Responsive > Font > Sizes
  if (path[0] === 'Font' && path[1] === 'Sizes') {
    const size_name = path[2] ?? '';
    const mapped = FONT_SIZE_NAME_MAP[size_name];
    if (mapped) return `--text-${mapped}`;
  }

  // ── Responsive > Grid spatial tokens
  const grid_path = path.join('/');
  if (grid_path === GRID_COLUMNS_PATH) {
    return '--grid-columns';
  }
  const grid_spatial = GRID_SPATIAL_NAME_MAP[grid_path];
  if (grid_spatial) return `--${grid_spatial}`;

  // ── Colour > Neutral (surface)
  if (path[0] === 'Colour' && path[1] === 'Neutral') {
    const level = path[2] ?? '';
    return `--color-neutral-${level.toLowerCase().replace(/\s+/g, '-')}`;
  }

  // ── Colour > {Hue} (surface, not Font/Icon)
  if (path[0] === 'Colour' && path.length === 3 &&
      path[1] !== 'Font' && path[1] !== 'Icon' && path[1] !== 'Neutral') {
    const hue = (path[1] ?? '').toLowerCase();
    const level = (path[2] ?? '').toLowerCase().replace(/\s+/g, '-');
    return `--color-${hue}-${level}`;
  }

  // ── Colour > Font > Neutral (foreground)
  if (path[0] === 'Colour' && path[1] === 'Font' && path[2] === 'Neutral') {
    const level = (path[3] ?? '').toLowerCase().replace(/\s+/g, '-');
    return `--color-fg-neutral-${level}`;
  }

  // ── Colour > Font > {Hue} (foreground)
  if (path[0] === 'Colour' && path[1] === 'Font' && path.length === 4) {
    const hue = (path[2] ?? '').toLowerCase();
    const level = (path[3] ?? '').toLowerCase().replace(/\s+/g, '-');
    return `--color-fg-${hue}-${level}`;
  }

  // ── Colour > Icon > {name}
  if (path[0] === 'Colour' && path[1] === 'Icon') {
    const name = (path[2] ?? '').toLowerCase().replace(/\s+/g, '-');
    return `--color-icon-${name}`;
  }

  // ── Effects > Opacity (overlay colours — under Light/Dark files)
  if (path[0] === 'Effects' && path[1] === 'Opacity') {
    const pct_key = path[2] ?? '';
    const mapped = OVERLAY_NAME_MAP[pct_key];
    if (mapped) return `--color-overlay-${mapped}`;
  }

  // ── Width token — not published
  if (path[0] === 'Width') {
    return '--_unpublished-width';
  }

  // Fallback: kebab-case the full path
  return '--' + path.map(s => s.toLowerCase().replace(/\s+/g, '-')).join('-');
}

// ─── Value Transform ───

const PX_SCOPES = new Set(['GAP', 'CORNER_RADIUS', 'STROKE_FLOAT', 'EFFECT_FLOAT', 'FONT_SIZE']);
const GRID_SPATIAL_PATHS = new Set(Object.keys(GRID_SPATIAL_NAME_MAP));

/**
 * Applies unit conversion:
 * - Dimensional tokens (by scope or grid spatial path) get px suffix
 * - Opacity tokens (scope: OPACITY) get divided by 100
 */
export function valueTransform(token: TransformedToken): unknown {
  const scopes = getScopes(token);
  const raw_value = token.$value ?? token.value;

  // Opacity normalisation: 0-100 → 0-1
  if (scopes.includes('OPACITY')) {
    const num = typeof raw_value === 'number' ? raw_value : parseFloat(String(raw_value));
    if (!isNaN(num)) {
      return num / 100;
    }
  }

  // Skip non-numeric values (colors, etc.)
  if (typeof raw_value !== 'number') return raw_value;

  // Scope-based px conversion
  const needs_px = scopes.some(s => PX_SCOPES.has(s));
  if (needs_px) {
    return `${raw_value}px`;
  }

  // Path-based px: grid spatial tokens have no Figma scope but are dimensional
  const { path } = stripNamespace(token.path);
  const grid_path = path.join('/');
  if (GRID_SPATIAL_PATHS.has(grid_path)) {
    return `${raw_value}px`;
  }

  return raw_value;
}

// ─── Alias Transform ───

/**
 * Replaces the token value with a var(--primitive-*) reference
 * when aliasData.targetVariableName is present.
 *
 * Special cases:
 * - Opacity tokens with aliases use calc(var(--primitive-*) / 100)
 * - Tokens without aliasData keep their current (already-transformed) value
 */
export function aliasTransform(token: TransformedToken): unknown {
  const alias_data = getAliasData(token);
  if (!alias_data?.targetVariableName) {
    // Preserve the value from the previous transform (units/opacity normalisation)
    return token.$value ?? token.value;
  }

  const primitive_var = figmaPathToPrimitiveCssVar(alias_data.targetVariableName);
  const scopes = getScopes(token);

  // Opacity tokens: wrap in calc() for the /100 normalisation
  if (scopes.includes('OPACITY')) {
    return `calc(var(${primitive_var}) / 100)`;
  }

  return `var(${primitive_var})`;
}
