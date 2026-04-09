/**
 * Style Dictionary v4 configuration factory.
 *
 * Builds the SD config for a given library (typographic, golden, base10).
 * Uses a custom parser to wrap each source file's content in a unique namespace
 * key, preventing token path collisions between files that share token paths
 * (e.g. Colours.Light vs Colours.Dark, Responsive.Desktop vs Tablet vs Mobile).
 */

import StyleDictionary from 'style-dictionary';
import type { PreprocessedTokens, DesignTokens } from 'style-dictionary/types';
import path from 'node:path';
import { figmaColorPreprocessor } from './preprocessors.js';
import { nameTransform, valueTransform, aliasTransform } from './transforms.js';
import { primitivesFormat, tokensFormat, tailwindThemeFormat } from './formats.js';
import { FILE_NAMESPACE } from './namespaces.js';

// ─── Library resolution ───

export interface LibraryConfig {
  shorthand: string;
  source_dir: string;
  output_slug: string;
}

export const LIBRARIES: LibraryConfig[] = [
  {
    shorthand: 'typographic',
    source_dir: 'libraries/typographic-ratio',
    output_slug: 'typographic-ratio',
  },
  {
    shorthand: 'golden',
    source_dir: 'libraries/golden-ratio',
    output_slug: 'golden-ratio',
  },
  {
    shorthand: 'base10',
    source_dir: 'libraries/base-10-ratio',
    output_slug: 'base-10-ratio',
  },
];

export function resolveLibrary(shorthand: string): LibraryConfig {
  const lib = LIBRARIES.find(l => l.shorthand === shorthand);
  if (!lib) {
    throw new Error(
      `Unknown library "${shorthand}". Valid options: ${LIBRARIES.map(l => l.shorthand).join(', ')}`
    );
  }
  return lib;
}

// ─── Source file list ───

const SOURCE_FILENAMES = [
  'Primatives.tokens.json',
  'Spacing.Positive.tokens.json',
  'Spacing.Negative.tokens.json',
  'Sizes.tokens.json',
  'Effects.tokens.json',
  'Colours.Light.tokens.json',
  'Colours.Dark.tokens.json',
  'Responsive.Desktop.tokens.json',
  'Responsive.Tablet.tokens.json',
  'Responsive.Mobile.tokens.json',
];

// ─── SD Registration & Config ───

let registered = false;

function registerCustomTransforms(): void {
  if (registered) return;
  registered = true;

  StyleDictionary.registerPreprocessor({
    name: 'figma/color-flatten',
    preprocessor: (dictionary) =>
      figmaColorPreprocessor(dictionary as Record<string, unknown>) as PreprocessedTokens,
  });

  StyleDictionary.registerTransform({
    name: 'name/figma-to-css',
    type: 'name',
    transform: (token, config) => nameTransform(token, config ?? {}),
  });

  StyleDictionary.registerTransform({
    name: 'value/units-and-opacity',
    type: 'value',
    transform: (token) => valueTransform(token),
  });

  StyleDictionary.registerTransform({
    name: 'value/alias-to-var',
    type: 'value',
    transform: (token) => aliasTransform(token),
  });

  StyleDictionary.registerFormat({
    name: 'css/primitives',
    format: primitivesFormat,
  });

  StyleDictionary.registerFormat({
    name: 'css/tokens',
    format: tokensFormat,
  });

  StyleDictionary.registerFormat({
    name: 'css/tailwind-theme',
    format: tailwindThemeFormat,
  });
}

/**
 * Builds all CSS outputs for a given library.
 *
 * The custom parser wraps each file's JSON in a namespace key to prevent
 * SD from merging tokens with identical paths across different source files.
 */
export async function buildLibrary(lib: LibraryConfig, root_dir: string): Promise<void> {
  registerCustomTransforms();

  const source_base = path.join(root_dir, lib.source_dir);
  const output_dir = path.join(root_dir, 'dist', lib.output_slug);

  const sd = new StyleDictionary({
    source: SOURCE_FILENAMES.map(f => path.join(source_base, f)),
    preprocessors: ['figma/color-flatten'],
    platforms: {
      css: {
        transforms: ['name/figma-to-css', 'value/units-and-opacity', 'value/alias-to-var'],
        buildPath: output_dir + '/',
        files: [
          {
            destination: 'primitives.css',
            format: 'css/primitives',
          },
          {
            destination: 'tokens.css',
            format: 'css/tokens',
          },
          {
            destination: 'tailwind-theme.css',
            format: 'css/tailwind-theme',
          },
        ],
      },
    },
    log: {
      verbosity: 'silent',
    },
    hooks: {
      parsers: {
        'figma-namespace-parser': {
          pattern: /\.tokens\.json$/,
          parser: ({ filePath, contents }): DesignTokens => {
            const filename = (filePath ?? '').split('/').pop() ?? '';
            const namespace = FILE_NAMESPACE[filename];
            const data = JSON.parse(contents) as Record<string, unknown>;

            // Remove root-level Figma metadata (mode name etc.) — not a token
            delete data['$extensions'];

            if (namespace) {
              return { [namespace]: data } as DesignTokens;
            }
            return data as DesignTokens;
          },
        },
      },
    },
    parsers: ['figma-namespace-parser'],
  });

  await sd.buildAllPlatforms();
}
