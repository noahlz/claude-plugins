import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Stage a tmp repo containing the file layout that `validateManifest` expects:
 * for each entry, create source dir + every include file + optional sourceReadme.
 *
 * Returns the tmp repo root. Caller is responsible for `rmSync` cleanup.
 */
export function makeFakeRepo(entries) {
  const root = mkdtempSync(path.join(tmpdir(), 'manifest-test-'));
  for (const entry of entries) {
    const dir = path.join(root, entry.source);
    mkdirSync(dir, { recursive: true });
    for (const rel of entry.include ?? []) {
      const fp = path.join(dir, rel);
      mkdirSync(path.dirname(fp), { recursive: true });
      writeFileSync(fp, '---\nname: x\ndescription: y\n---\n');
    }
    if (entry.sourceReadme) {
      writeFileSync(path.join(dir, entry.sourceReadme), '# x\n');
    }
  }
  return root;
}
