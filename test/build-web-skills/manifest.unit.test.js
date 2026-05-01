import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { MANIFEST, validateManifest } from '../../scripts/build-web-skills/manifest.js';
import { makeFakeRepo } from './helpers.js';

const repoRoot = path.resolve(import.meta.dirname, '../..');

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
    // Name validation runs before fs lookups, so no fake repo is needed.
    assert.throws(
      () => validateManifest(
        [{ name: 'BadName', plugin: 'p', source: 'x', include: ['SKILL.md'] }],
        repoRoot
      ),
      /lowercase letters/
    );
  });

  it('rejects duplicate names', () => {
    // Duplicate-name check fires on the second entry, but the first entry's
    // source-dir existence is checked first — so we need real source dirs to
    // get past entry 1 and reach the duplicate detection on entry 2.
    const entries = [
      { name: 'dup', plugin: 'p', source: 'a', include: ['SKILL.md'] },
      { name: 'dup', plugin: 'p', source: 'b', include: ['SKILL.md'] },
    ];
    let fakeRoot;
    try {
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
    // Manifest entry claims two includes; we deliberately stage only one of them.
    const entry = { name: 'x', plugin: 'p', source: 'sk', include: ['SKILL.md', 'missing.md'] };
    let fakeRoot;
    try {
      fakeRoot = makeFakeRepo([{ ...entry, include: ['SKILL.md'] }]);
      assert.throws(() => validateManifest([entry], fakeRoot), /include file not found/);
    } finally {
      if (fakeRoot) rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it('rejects when sourceReadme is set but missing', () => {
    const entry = {
      name: 'x', plugin: 'p', source: 'sk',
      include: ['SKILL.md'], sourceReadme: 'README.md',
    };
    let fakeRoot;
    try {
      // Stage the include but omit the sourceReadme file.
      fakeRoot = makeFakeRepo([{ ...entry, sourceReadme: undefined }]);
      assert.throws(() => validateManifest([entry], fakeRoot), /sourceReadme not found/);
    } finally {
      if (fakeRoot) rmSync(fakeRoot, { recursive: true, force: true });
    }
  });
});
