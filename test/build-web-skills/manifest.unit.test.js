import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MANIFEST, validateManifest } from '../../scripts/build-web-skills/manifest.js';

const repoRoot = path.resolve(import.meta.dirname, '../..');

function makeFakeRepo(entries) {
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

describe('manifest', () => {
  it('the real MANIFEST validates against the real repo', () => {
    assert.doesNotThrow(() => validateManifest(MANIFEST, repoRoot));
  });

  it('the real MANIFEST contains the three target skills', () => {
    const names = MANIFEST.map(e => e.name).sort();
    assert.deepEqual(names, ['craft-linkedin-post', 'de-llm', 'tighten-for-llms']);
  });

  it('rejects empty manifest', () => {
    assert.throws(() => validateManifest([], repoRoot), /non-empty array/);
  });

  it('rejects entry with missing required field', () => {
    assert.throws(
      () => validateManifest([{ name: 'x', plugin: 'p', source: 's' /* no include */ }], repoRoot),
      /missing required field "include"/
    );
  });

  it('rejects entry with invalid name', () => {
    let fakeRoot;
    try {
      fakeRoot = makeFakeRepo([{ name: 'BadName', plugin: 'p', source: 'x', include: ['SKILL.md'] }]);
      assert.throws(
        () => validateManifest(
          [{ name: 'BadName', plugin: 'p', source: 'x', include: ['SKILL.md'] }],
          fakeRoot
        ),
        /lowercase letters/
      );
    } finally {
      if (fakeRoot) rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it('rejects duplicate names', () => {
    let fakeRoot;
    try {
      const entries = [
        { name: 'dup', plugin: 'p', source: 'a', include: ['SKILL.md'] },
        { name: 'dup', plugin: 'p', source: 'b', include: ['SKILL.md'] },
      ];
      fakeRoot = makeFakeRepo(entries);
      assert.throws(() => validateManifest(entries, fakeRoot), /duplicate name/);
    } finally {
      if (fakeRoot) rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it('rejects missing SKILL.md in include', () => {
    assert.throws(
      () => validateManifest(
        [{ name: 'x', plugin: 'p', source: 's', include: ['references/patterns.md'] }],
        repoRoot
      ),
      /must contain "SKILL.md"/
    );
  });

  it('rejects when source dir does not exist', () => {
    assert.throws(
      () => validateManifest(
        [{ name: 'x', plugin: 'p', source: 'no/such/dir', include: ['SKILL.md'] }],
        repoRoot
      ),
      /source dir not found/
    );
  });

  it('rejects when an include file does not exist', () => {
    let fakeRoot;
    try {
      const entries = [{ name: 'x', plugin: 'p', source: 'sk', include: ['SKILL.md', 'missing.md'] }];
      fakeRoot = makeFakeRepo([{ ...entries[0], include: ['SKILL.md'] }]);
      assert.throws(() => validateManifest(entries, fakeRoot), /include file not found/);
    } finally {
      if (fakeRoot) rmSync(fakeRoot, { recursive: true, force: true });
    }
  });
});
