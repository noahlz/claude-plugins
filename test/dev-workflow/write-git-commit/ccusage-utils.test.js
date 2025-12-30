import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { pwdToSessionId } from '../../../plugins/dev-workflow/skills/write-git-commit/scripts/ccusage-utils.js';

describe('write-git-commit: ccusage-utils.js', () => {
  it('converts absolute path to session ID format', () => {
    const result = pwdToSessionId('/Users/noahlz/projects/claude-plugins');
    assert.equal(result, '-Users-noahlz-projects-claude-plugins');
  });

  it('converts path without leading slash', () => {
    const result = pwdToSessionId('Users/noahlz/projects/test');
    assert.equal(result, '-Users-noahlz-projects-test');
  });

  it('handles paths with trailing slash', () => {
    const result = pwdToSessionId('/Users/noahlz/projects/test/');
    assert.equal(result, '-Users-noahlz-projects-test-');
  });

  it('handles single-level paths', () => {
    const result = pwdToSessionId('/home');
    assert.equal(result, '-home');
  });

  it('handles root path', () => {
    const result = pwdToSessionId('/');
    assert.equal(result, '-');
  });

  it('handles paths with multiple consecutive slashes', () => {
    const result = pwdToSessionId('/Users//noahlz///projects');
    assert.equal(result, '-Users--noahlz---projects');
  });

  it('always prefixes with dash', () => {
    const testPaths = [
      '/Users/test',
      'Users/test',
      '/home/user/project'
    ];

    testPaths.forEach(path => {
      const result = pwdToSessionId(path);
      assert.ok(result.startsWith('-'), `Result should start with dash: ${result}`);
    });
  });

  it('replaces all forward slashes with dashes', () => {
    const result = pwdToSessionId('/a/b/c/d/e');
    assert.equal(result, '-a-b-c-d-e');
    assert.equal((result.match(/-/g) || []).length, 5);
  });
});
