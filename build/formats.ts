/**
 * Three custom Style Dictionary v4 format functions:
 * 1. primitives.css — :root with raw palette values
 * 2. tokens.css — semantic vars with var() references, .dark overrides, @media breakpoints
 * 3. tailwind-theme.css — @theme static block for Tailwind v4 namespace tokens
 *
 * Token partitioning uses the parser namespace prefix (token.path[0]) to determine
 * which CSS section each token belongs in, avoiding reliance on SD's filePath property.
 */

import type { TransformedToken, FormatFnArguments } from 'style-dictionary/types';
import { isThemeNamespace } from './token-names.js';
import { NS, ROOT_NAMESPACES, ROOT_NS_ORDER } from './namespaces.js';

// ─── Types & Helpers ───

interface TokenEntry {
  name: string;
  value: string;
  ns: string;
}

function toEntry(token: TransformedToken): TokenEntry {
  return {
    name: token.name,
    value: String(token.$value ?? token.value),
    ns: token.path[0] ?? '',
  };
}

function formatVar(name: string, value: string): string {
  return `  ${name}: ${value};`;
}

/**
 * Partitions all tokens by namespace into output sections.
 * Sorts root_light tokens by the canonical namespace order for clean CSS output.
 */
function partitionTokens(all_tokens: TransformedToken[]): {
  primitives: TokenEntry[];
  root_light: TokenEntry[];
  dark: TokenEntry[];
  tablet: TokenEntry[];
  mobile: TokenEntry[];
} {
  const primitives: TokenEntry[] = [];
  const root_light: TokenEntry[] = [];
  const dark: TokenEntry[] = [];
  const tablet: TokenEntry[] = [];
  const mobile: TokenEntry[] = [];

  for (const token of all_tokens) {
    if (token.name.startsWith('--_unpublished')) continue;

    const entry = toEntry(token);

    if (entry.ns === NS.PRIMITIVE) {
      primitives.push(entry);
    } else if (entry.ns === NS.DARK) {
      dark.push(entry);
    } else if (entry.ns === NS.TABLET) {
      tablet.push(entry);
    } else if (entry.ns === NS.MOBILE) {
      mobile.push(entry);
    } else if (ROOT_NAMESPACES.has(entry.ns)) {
      root_light.push(entry);
    }
    // __spacing_neg__ and other unmapped namespaces are silently excluded
  }

  // Stable sort by namespace order: spacing → sizes → effects → responsive → colours
  root_light.sort((a, b) => {
    const a_idx = ROOT_NS_ORDER.indexOf(a.ns);
    const b_idx = ROOT_NS_ORDER.indexOf(b.ns);
    if (a_idx === b_idx) return 0;
    return a_idx - b_idx;
  });

  return { primitives, root_light, dark, tablet, mobile };
}

/**
 * Filters responsive tokens to only those that actually differ from desktop defaults.
 */
function filterChangedTokens(
  responsive_tokens: TokenEntry[],
  desktop_map: Map<string, string>
): TokenEntry[] {
  return responsive_tokens.filter(t => {
    const desktop_val = desktop_map.get(t.name);
    return desktop_val !== t.value;
  });
}

/**
 * Builds a desktop defaults map from root_light tokens for responsive diffing.
 * Only tracks token names that appear in responsive files.
 */
function buildDesktopMap(root_light: TokenEntry[]): Map<string, string> {
  const desktop_map = new Map<string, string>();
  for (const t of root_light) {
    if (t.name.startsWith('--text-') ||
        t.name.startsWith('--spacing-grid-') ||
        t.name === '--grid-columns') {
      desktop_map.set(t.name, t.value);
    }
  }
  return desktop_map;
}

// ─── Primitives Format ───

export function primitivesFormat({ dictionary }: FormatFnArguments): string {
  const { primitives } = partitionTokens(dictionary.allTokens);
  const lines = primitives.map(t => formatVar(t.name, t.value));
  return `:root {\n${lines.join('\n')}\n}\n`;
}

// ─── Tokens Format ───

export function tokensFormat({ dictionary }: FormatFnArguments): string {
  const { root_light, dark, tablet, mobile } = partitionTokens(dictionary.allTokens);

  const desktop_map = buildDesktopMap(root_light);

  const root_lines = root_light.map(t => formatVar(t.name, t.value));
  const dark_lines = dark.map(t => formatVar(t.name, t.value));
  const tablet_changed = filterChangedTokens(tablet, desktop_map);
  const mobile_changed = filterChangedTokens(mobile, desktop_map);

  let output = `@import "./primitives.css";\n\n`;
  output += `:root {\n${root_lines.join('\n')}\n}\n`;

  if (dark_lines.length > 0) {
    output += `\n.dark,\n[data-theme="dark"] {\n${dark_lines.join('\n')}\n}\n`;
  }

  if (tablet_changed.length > 0) {
    output += `\n@media (min-width: 768px) and (max-width: 1199px) {\n  :root {\n`;
    output += tablet_changed.map(t => `    ${t.name}: ${t.value};`).join('\n');
    output += `\n  }\n}\n`;
  }

  if (mobile_changed.length > 0) {
    output += `\n@media (max-width: 767px) {\n  :root {\n`;
    output += mobile_changed.map(t => `    ${t.name}: ${t.value};`).join('\n');
    output += `\n  }\n}\n`;
  }

  return output;
}

// ─── Tailwind Theme Format ───

export function tailwindThemeFormat({ dictionary }: FormatFnArguments): string {
  const { root_light, dark, tablet, mobile } = partitionTokens(dictionary.allTokens);

  // Split root tokens: namespace-valid → @theme static, others → :root
  const theme_tokens: TokenEntry[] = [];
  const root_tokens: TokenEntry[] = [];

  for (const t of root_light) {
    if (isThemeNamespace(t.name)) {
      theme_tokens.push(t);
    } else {
      root_tokens.push(t);
    }
  }

  const desktop_map = buildDesktopMap(root_light);

  let output = `@import "tailwindcss";\n@import "./primitives.css";\n\n`;

  // Zone 1: @theme static — generates utility classes
  if (theme_tokens.length > 0) {
    const theme_lines = theme_tokens.map(t => formatVar(t.name, t.value));
    output += `@theme static {\n${theme_lines.join('\n')}\n}\n`;
  }

  // Zone 2: :root — non-namespace tokens (opacity, border weight, grid-columns)
  if (root_tokens.length > 0) {
    const root_lines = root_tokens.map(t => formatVar(t.name, t.value));
    output += `\n:root {\n${root_lines.join('\n')}\n}\n`;
  }

  // Zone 3: .dark overrides
  const dark_lines = dark.map(t => formatVar(t.name, t.value));
  if (dark_lines.length > 0) {
    output += `\n.dark,\n[data-theme="dark"] {\n${dark_lines.join('\n')}\n}\n`;
  }

  // Zone 4: Responsive overrides
  const tablet_changed = filterChangedTokens(tablet, desktop_map);
  const mobile_changed = filterChangedTokens(mobile, desktop_map);

  if (tablet_changed.length > 0) {
    output += `\n@media (min-width: 768px) and (max-width: 1199px) {\n  :root {\n`;
    output += tablet_changed.map(t => `    ${t.name}: ${t.value};`).join('\n');
    output += `\n  }\n}\n`;
  }

  if (mobile_changed.length > 0) {
    output += `\n@media (max-width: 767px) {\n  :root {\n`;
    output += mobile_changed.map(t => `    ${t.name}: ${t.value};`).join('\n');
    output += `\n  }\n}\n`;
  }

  return output;
}
