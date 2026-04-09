/**
 * CLI entry point for the design token build pipeline.
 *
 * Usage:
 *   tsx build/index.ts                    # builds typographic (default)
 *   tsx build/index.ts --library golden   # builds golden ratio
 *   tsx build/index.ts --all              # builds all three libraries
 */

import path from 'node:path';
import { buildLibrary, resolveLibrary, LIBRARIES } from './config.js';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const build_all = args.includes('--all');

  if (build_all) {
    console.log('[build] Building all libraries...');
    for (const lib of LIBRARIES) {
      console.log(`[build] → ${lib.shorthand} (${lib.output_slug})`);
      await buildLibrary(lib, ROOT_DIR);
      console.log(`[build] ✓ ${lib.output_slug} completed`);
    }
    console.log('[build] All libraries built successfully.');
    return;
  }

  const library_idx = args.indexOf('--library');
  const shorthand = library_idx !== -1 ? args[library_idx + 1] : 'typographic';

  if (!shorthand) {
    console.error('[build] Missing library name after --library flag');
    process.exit(1);
  }

  const lib = resolveLibrary(shorthand);
  console.log(`[build] Building ${lib.shorthand} (${lib.output_slug})...`);
  await buildLibrary(lib, ROOT_DIR);
  console.log(`[build] ✓ ${lib.output_slug} completed`);
}

main().catch((err) => {
  console.error('[build] Fatal error:', err);
  process.exit(1);
});
