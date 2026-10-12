import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  setupTestEnv,
  teardownTestEnv,
  execGit,
  execNodeScript,
  getPluginLibPath,
  extractJsonFromOutput
} from '../../lib/helpers.js';
import { setupGitRepo } from '../commit-with-costs/helpers.js';
import { addWorktree, commitOnBranch } from '../merge-with-costs/helpers.js';
import {
  resolveProjectRoot,
  skillConfigPath,
  readSkillConfig,
  writeSkillConfig
} from '../../../plugins/dev-workflow/lib/skill-config.js';

const SKILL = 'commit-with-costs';
const NO_ENV = {};

describe('lib: skill-config.js', () => {
  let testEnv;
  let root;
  let subdir;

  beforeEach(() => {
    testEnv = setupTestEnv();
    setupGitRepo(testEnv);
    assert.equal(execGit(['rev-parse', '--verify', 'HEAD'], { cwd: testEnv.tmpDir }).exitCode, 0, 'initial commit should exist');
    // git reports the realpath (macOS tmpdir is a /var -> /private/var symlink)
    root = realpathSync(testEnv.tmpDir);
    subdir = join(root, 'docs', 'nested');
    mkdirSync(subdir, { recursive: true });
  });

  afterEach(() => teardownTestEnv(testEnv));

  const configFile = (dir = root) => join(dir, '.claude', `settings.plugins.${SKILL}.json`);
  const writeRootConfig = (config) => writeFileSync(configFile(), JSON.stringify(config));

  describe('resolveProjectRoot', () => {
    it('resolves a subdirectory to the repository root', () => {
      assert.equal(resolveProjectRoot({ env: NO_ENV, cwd: subdir }), root);
    });

    it('prefers CLAUDE_PROJECT_DIR over the repository root', () => {
      const other = join(root, 'elsewhere');
      assert.equal(resolveProjectRoot({ env: { CLAUDE_PROJECT_DIR: other }, cwd: subdir }), other);
    });

    it('resolves a linked worktree to its own toplevel, not the main working tree', () => {
      commitOnBranch(testEnv, 'feature-a', 'a.txt', 'a');
      const worktree = addWorktree(testEnv, 'feature-a');
      assert.ok(existsSync(join(worktree, 'a.txt')), 'worktree should check out the committed branch');

      assert.equal(resolveProjectRoot({ env: NO_ENV, cwd: worktree }), realpathSync(worktree));
    });

    it('falls back to cwd outside a git repository', () => {
      const outside = realpathSync(mkdtempSync(join(tmpdir(), 'node-test-nogit-')));
      try {
        assert.equal(resolveProjectRoot({ env: NO_ENV, cwd: outside }), outside);
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }
    });
  });

  describe('skillConfigPath', () => {
    it('places the config under the project root from a subdirectory', () => {
      assert.equal(skillConfigPath(SKILL, { env: NO_ENV, cwd: subdir }), configFile());
    });
  });

  describe('readSkillConfig', () => {
    it('reads the root config from a subdirectory', () => {
      writeRootConfig({ sessionId: 'root-id' });

      const result = readSkillConfig(SKILL, { env: NO_ENV, cwd: subdir });

      assert.deepEqual(result, { path: configFile(), projectRoot: root, config: { sessionId: 'root-id' } });
    });

    it('returns a null config when the file is missing', () => {
      assert.equal(readSkillConfig(SKILL, { env: NO_ENV, cwd: subdir }).config, null);
    });
  });

  describe('writeSkillConfig', () => {
    it('writes to the project root when called from a subdirectory', () => {
      rmSync(join(root, '.claude'), { recursive: true, force: true });

      const result = writeSkillConfig(SKILL, { sessionId: 'new-id' }, { env: NO_ENV, cwd: subdir });

      assert.deepEqual(result, { status: 'created', path: configFile() });
      assert.deepEqual(JSON.parse(readFileSync(configFile(), 'utf-8')), { sessionId: 'new-id' });
      assert.equal(existsSync(join(subdir, '.claude')), false);
    });

    it('refuses to overwrite an existing config', () => {
      writeRootConfig({ sessionId: 'original' });

      const result = writeSkillConfig(SKILL, { sessionId: 'clobber' }, { env: NO_ENV, cwd: root });

      assert.equal(result.status, 'exists');
      assert.deepEqual(JSON.parse(readFileSync(configFile(), 'utf-8')), { sessionId: 'original' });
    });

    it('overwrites an existing config only with replace', () => {
      writeRootConfig({ sessionId: 'original' });

      const result = writeSkillConfig(SKILL, { sessionId: 'updated' }, { env: NO_ENV, cwd: root, replace: true });

      assert.equal(result.status, 'replaced');
      assert.deepEqual(JSON.parse(readFileSync(configFile(), 'utf-8')), { sessionId: 'updated' });
    });
  });

  describe('CLI', () => {
    const cli = (args, cwd = subdir) => execNodeScript(getPluginLibPath('dev-workflow', 'skill-config.js'), { args, cwd });

    it('check finds the root config from a subdirectory', () => {
      writeRootConfig({ sessionId: 'root-id' });
      assert.match(cli(['check', SKILL]).stdout, /^✓ Configuration found/);
    });

    it('check reports NOT_CONFIGURED with the expected path when missing', () => {
      assert.equal(cli(['check', SKILL]).stdout.trim(), `NOT_CONFIGURED: ${configFile()}`);
    });

    it('read prints the root config as JSON from a subdirectory', () => {
      writeRootConfig({ sessionId: '-Users-me-project' });

      const json = extractJsonFromOutput(cli(['read', SKILL]).stdout);

      assert.deepEqual(json, { path: configFile(), projectRoot: root, config: { sessionId: '-Users-me-project' } });
    });

    it('write creates the root config from a subdirectory', () => {
      const json = extractJsonFromOutput(cli(['write', SKILL, '{"sessionId":"-Users-me-project"}']).stdout);

      assert.equal(json.status, 'created');
      assert.deepEqual(JSON.parse(readFileSync(configFile(), 'utf-8')), { sessionId: '-Users-me-project' });
    });

    it('write leaves an existing config untouched without --replace', () => {
      writeRootConfig({ sessionId: 'original' });

      const json = extractJsonFromOutput(cli(['write', SKILL, '{"sessionId":"clobber"}']).stdout);

      assert.equal(json.status, 'exists');
      assert.deepEqual(JSON.parse(readFileSync(configFile(), 'utf-8')), { sessionId: 'original' });
    });

    it('write --replace overwrites an existing config', () => {
      writeRootConfig({ sessionId: 'original' });

      const json = extractJsonFromOutput(cli(['write', SKILL, '{"sessionId":"updated"}', '--replace']).stdout);

      assert.equal(json.status, 'replaced');
      assert.deepEqual(JSON.parse(readFileSync(configFile(), 'utf-8')), { sessionId: 'updated' });
    });

    it('write rejects invalid JSON without touching the file', () => {
      const json = extractJsonFromOutput(cli(['write', SKILL, 'not json']).stdout);

      assert.equal(json.status, 'error');
      assert.equal(existsSync(configFile()), false);
    });
  });
});
