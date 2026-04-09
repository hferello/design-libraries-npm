/**
 * Figma colour object preprocessor for Style Dictionary v4.
 *
 * Figma exports colors as objects with { colorSpace, components, alpha, hex }.
 * SD expects flat string values. This preprocessor flattens them while preserving
 * $extensions (needed for alias resolution downstream).
 */

interface FigmaColorValue {
  colorSpace: string;
  components: number[];
  alpha: number;
  hex: string;
}

function isFigmaColorObject(value: unknown): value is FigmaColorValue {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['hex'] === 'string' &&
    Array.isArray(obj['components']) &&
    typeof obj['alpha'] === 'number'
  );
}

/**
 * Rounds a number to a fixed number of decimal places, stripping trailing zeros.
 */
function roundAlpha(alpha: number): number {
  return Math.round(alpha * 100) / 100;
}

/**
 * Converts a 0-1 float component to a 0-255 integer.
 */
function to8Bit(component: number): number {
  return Math.round(component * 255);
}

/**
 * Recursively walks the token tree and flattens Figma color objects
 * to either a hex string (alpha === 1) or an rgba() string (alpha < 1).
 */
function flattenColorObjects(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key === '$value' && isFigmaColorObject(value)) {
      const alpha = roundAlpha(value.alpha);
      if (alpha >= 1) {
        result[key] = value.hex;
      } else {
        const [r_f, g_f, b_f] = value.components;
        const r = to8Bit(r_f ?? 0);
        const g = to8Bit(g_f ?? 0);
        const b = to8Bit(b_f ?? 0);
        result[key] = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = flattenColorObjects(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * SD v4 preprocessor hook. Receives the raw token dictionary and returns
 * a new dictionary with color objects flattened. $extensions stay intact.
 */
export function figmaColorPreprocessor(dictionary: Record<string, unknown>): Record<string, unknown> {
  return flattenColorObjects(dictionary);
}
