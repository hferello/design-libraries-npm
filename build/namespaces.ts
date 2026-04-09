/**
 * Parser namespace constants to prevent token path collisions in SD v4.
 *
 * SD v4 merges tokens that share the same path across source files (e.g.,
 * Colours.Light and Colours.Dark both define Colour/Neutral/Base). The parser
 * wraps each file's content in a unique namespace key, so SD sees distinct
 * paths. The name transform strips the namespace before generating CSS names,
 * and the format functions use it to partition tokens into the correct
 * CSS sections (:root, .dark, @media).
 */

export const FILE_NAMESPACE: Record<string, string> = {
  'Primatives.tokens.json': '__primitive__',
  'Spacing.Positive.tokens.json': '__spacing_pos__',
  'Spacing.Negative.tokens.json': '__spacing_neg__',
  'Sizes.tokens.json': '__sizes__',
  'Effects.tokens.json': '__effects__',
  'Colours.Light.tokens.json': '__light__',
  'Colours.Dark.tokens.json': '__dark__',
  'Responsive.Desktop.tokens.json': '__desktop__',
  'Responsive.Tablet.tokens.json': '__tablet__',
  'Responsive.Mobile.tokens.json': '__mobile__',
};

export const NS = {
  PRIMITIVE: '__primitive__',
  SPACING_POS: '__spacing_pos__',
  SPACING_NEG: '__spacing_neg__',
  SIZES: '__sizes__',
  EFFECTS: '__effects__',
  LIGHT: '__light__',
  DARK: '__dark__',
  DESKTOP: '__desktop__',
  TABLET: '__tablet__',
  MOBILE: '__mobile__',
} as const;

export type Namespace = (typeof NS)[keyof typeof NS];

export const ALL_NAMESPACES = new Set<string>(Object.values(NS));

/** Namespaces whose tokens belong in the :root / @theme static (light default) section */
export const ROOT_NAMESPACES = new Set<string>([
  NS.SPACING_POS,
  NS.SIZES,
  NS.EFFECTS,
  NS.DESKTOP,
  NS.LIGHT,
]);

/** Output ordering for root section: spacing → sizes → effects → responsive → colours */
export const ROOT_NS_ORDER: readonly string[] = [
  NS.SPACING_POS,
  NS.SIZES,
  NS.EFFECTS,
  NS.DESKTOP,
  NS.LIGHT,
];
