/**
 * Static name mappings from Figma's descriptive token names to concise CSS-friendly names.
 * These mappings are consumed by the name transform to produce the final CSS variable names.
 */

// Spacing: Figma uses long descriptive phrases; we map to single-word semantic names.
// All 11 positive spacing values — "section" and "independent" both resolve to 36px.
export const SPACING_NAME_MAP: Record<string, string> = {
  'Flush': 'flush',
  'Tightly related, one unit': 'tight',
  'Clearly paired, slight breath': 'paired',
  'Same group, distinct items': 'grouped',
  'Loose group, breathing room': 'loose',
  'Distinct sections, clear gap': 'section',
  'Independent, different context': 'independent',
  'New section': 'region',
  'Clear visual break between zones': 'zone',
  'Unrelated, structural separation': 'divide',
  'Very far apart': 'apart',
};

// Font sizes: Figma uses "XSmall", "Regular", etc.; we map to Tailwind-style abbreviations.
export const FONT_SIZE_NAME_MAP: Record<string, string> = {
  'XSmall': 'xs',
  'Small': 'sm',
  'Regular': 'base',
  'Medium': 'md',
  'Large': 'lg',
  'XLarge': 'xl',
  'XXLarge': '2xl',
};

// Grid spatial tokens: mapped into --spacing-grid-* namespace for Tailwind utility generation.
export const GRID_SPATIAL_NAME_MAP: Record<string, string> = {
  'Grid/Margin': 'spacing-grid-margin',
  'Grid/Gutter': 'spacing-grid-gutter',
  'Grid/Vertical/Tight': 'spacing-grid-vertical-tight',
  'Grid/Vertical/Default': 'spacing-grid-vertical-default',
  'Grid/Vertical/Loose': 'spacing-grid-vertical-loose',
};

// Grid columns: no Tailwind namespace, stays as a plain --grid-columns var.
export const GRID_COLUMNS_PATH = 'Grid/Horizontal';

// Opacity levels: mapped from Figma "Full", "High", etc. to lowercase.
export const OPACITY_NAME_MAP: Record<string, string> = {
  'Full': 'full',
  'High': 'high',
  'Medium': 'medium',
  'Low': 'low',
  'Faint': 'faint',
};

// Overlay percentages: strip the % suffix from keys like "8%", "12%", etc.
export const OVERLAY_NAME_MAP: Record<string, string> = {
  '0%': '0',
  '8%': '8',
  '12%': '12',
  '16%': '16',
  '24%': '24',
  '36%': '36',
  '48%': '48',
  '60%': '60',
  '72%': '72',
  '96%': '96',
};

// Border radius: Figma scope is CORNER_RADIUS.
export const RADIUS_NAME_MAP: Record<string, string> = {
  'Sharp': 'sharp',
  'Subtle': 'subtle',
  'Soft': 'soft',
  'Rounded': 'rounded',
  'Pill': 'pill',
  'Circular': 'circular',
};

// Border weight: Figma scope is STROKE_FLOAT.
export const BORDER_WEIGHT_NAME_MAP: Record<string, string> = {
  'Hairline': 'hairline',
  'Defined': 'defined',
  'Bold': 'bold',
  'Graphic': 'graphic',
};

// Blur: Figma scope is EFFECT_FLOAT.
export const BLUR_NAME_MAP: Record<string, string> = {
  'Soft': 'soft',
  'Hazy': 'hazy',
  'Foggy': 'foggy',
  'Void': 'void',
};

// Tailwind v4 namespaces that belong inside @theme static.
// Tokens matching these prefixes generate utility classes.
export const TAILWIND_THEME_NAMESPACES = [
  '--spacing-',
  '--text-',
  '--color-',
  '--radius-',
  '--blur-',
] as const;

/**
 * Checks whether a CSS variable name belongs inside @theme static.
 * Only documented Tailwind v4 namespace prefixes qualify.
 */
export function isThemeNamespace(css_var_name: string): boolean {
  return TAILWIND_THEME_NAMESPACES.some(ns => css_var_name.startsWith(ns));
}
