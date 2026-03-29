import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import path from 'node:path';
import { setupTestEnv, teardownTestEnv } from '../../lib/helpers.js';
import { scanProjectContext } from '../../../plugins/dev-workflow/skills/check-changelog/scripts/scan-project-context.js';

// Build mock deps from a set of "existing" path suffixes and a content map.
// existingPaths: array of path suffixes relative to cwd (e.g. 'CLAUDE.md', '.claude/settings.json')
// contentMap:   { [pathSuffix]: string } — what readFileSafe returns for that suffix
// cwd is used to resolve suffixes to absolute paths so existsSync matches exactly.
function createMockDeps(existingPaths = [], contentMap = {}, cwd = '/') {
  // Build a Set of absolute paths so existsSync never produces false positives from shared suffixes.
  const existingSet = new Set(existingPaths.map(p => path.join(cwd, p)));

  return {
    fs: {
      existsSync(fullPath) {
        return existingSet.has(fullPath);
      }
    },
    readFileSafe(fullPath) {
      const matchedKey = Object.keys(contentMap).find(suffix => fullPath === path.join(cwd, suffix));
      if (!matchedKey) return '';
      return contentMap[matchedKey];
    }
  };
}

describe('check-changelog: scan-project-context.js unit tests', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv(testEnv);
  });

  describe('scanProjectContext', () => {
    it('throws when deps is null', () => {
      assert.throws(
        () => scanProjectContext(testEnv.tmpDir, null),
        /deps is required/
      );
    });

    it('returns empty result for an empty project', () => {
      const deps = createMockDeps([], {}, testEnv.tmpDir);
      const result = scanProjectContext(testEnv.tmpDir, deps);

      assert.equal(result.status, 'success');
      assert.deepEqual(result.data.claudeMdFiles, []);
      assert.equal(result.data.claudeDir.exists, false);
      assert.deepEqual(result.data.claudeDir.settingKeys, []);
      assert.equal(result.data.claudeDir.hasHooks, false);
      assert.deepEqual(result.data.projectTypes, []);
      assert.deepEqual(result.data.plugins, []);
    });

    it('finds CLAUDE.md files and truncates preview at 500 chars', () => {
      const longContent = 'A'.repeat(600);
      const deps = createMockDeps(
        ['CLAUDE.md', path.join('src', 'CLAUDE.md')],
        {
          'CLAUDE.md': longContent,
          [path.join('src', 'CLAUDE.md')]: 'short content'
        },
        testEnv.tmpDir
      );

      const result = scanProjectContext(testEnv.tmpDir, deps);

      assert.equal(result.status, 'success');
      assert.equal(result.data.claudeMdFiles.length, 2);

      const rootFile = result.data.claudeMdFiles.find(f => f.path === 'CLAUDE.md');
      assert.ok(rootFile, 'CLAUDE.md should be found');
      assert.equal(rootFile.preview.length, 500);

      const srcFile = result.data.claudeMdFiles.find(f => f.path === path.join('src', 'CLAUDE.md'));
      assert.ok(srcFile, 'src/CLAUDE.md should be found');
      assert.equal(srcFile.preview, 'short content');
    });

    it('detects .claude directory with settings and extracts settingKeys', () => {
      const settings = { theme: 'dark', language: 'en', autoSave: true };
      const deps = createMockDeps(
        ['.claude', path.join('.claude', 'settings.json')],
        { [path.join('.claude', 'settings.json')]: JSON.stringify(settings) },
        testEnv.tmpDir
      );

      const result = scanProjectContext(testEnv.tmpDir, deps);

      assert.equal(result.status, 'success');
      assert.equal(result.data.claudeDir.exists, true);
      assert.deepEqual(result.data.claudeDir.settingKeys.sort(), ['autoSave', 'language', 'theme']);
      assert.equal(result.data.claudeDir.hasHooks, false);
      // parsedSettings must not leak through the public data shape
      assert.equal('parsedSettings' in result.data.claudeDir, false);
    });

    it('detects hasHooks = true via hooks.json file', () => {
      const deps = createMockDeps(
        ['.claude', path.join('.claude', 'hooks.json')],
        {},
        testEnv.tmpDir
      );

      const result = scanProjectContext(testEnv.tmpDir, deps);

      assert.equal(result.status, 'success');
      assert.equal(result.data.claudeDir.exists, true);
      assert.equal(result.data.claudeDir.hasHooks, true);
    });

    it('detects hasHooks = true via "hooks" key in settings.json', () => {
      const settings = { hooks: { PreToolUse: [] } };
      const deps = createMockDeps(
        ['.claude', path.join('.claude', 'settings.json')],
        { [path.join('.claude', 'settings.json')]: JSON.stringify(settings) },
        testEnv.tmpDir
      );

      const result = scanProjectContext(testEnv.tmpDir, deps);

      assert.equal(result.status, 'success');
      assert.equal(result.data.claudeDir.hasHooks, true);
    });

    it('detects project types for package.json and Cargo.toml', () => {
      const deps = createMockDeps(['package.json', 'Cargo.toml'], {}, testEnv.tmpDir);

      const result = scanProjectContext(testEnv.tmpDir, deps);

      assert.equal(result.status, 'success');
      assert.ok(result.data.projectTypes.includes('package.json'));
      assert.ok(result.data.projectTypes.includes('Cargo.toml'));
      assert.equal(result.data.projectTypes.length, 2);
    });

    it('extracts plugins from settings key containing "plugin"', () => {
      const settings = {
        plugins: ['dev-workflow', 'frontend-design'],
        otherKey: 'ignored'
      };
      const deps = createMockDeps(
        ['.claude', path.join('.claude', 'settings.json')],
        { [path.join('.claude', 'settings.json')]: JSON.stringify(settings) },
        testEnv.tmpDir
      );

      const result = scanProjectContext(testEnv.tmpDir, deps);

      assert.equal(result.status, 'success');
      assert.deepEqual(result.data.plugins, ['dev-workflow', 'frontend-design']);
    });

    it('returns error status when readFileSafe throws', () => {
      const deps = {
        fs: { existsSync: () => true },
        readFileSafe() {
          throw new Error('read failed');
        }
      };

      const result = scanProjectContext(testEnv.tmpDir, deps);

      assert.equal(result.status, 'error');
      assert.match(result.error, /read failed/);
    });
  });
});
