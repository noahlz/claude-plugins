import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { PREP_HOOKS } from '../../scripts/build-web-skills/index.js';
import { MANIFEST } from '../../scripts/build-web-skills/manifest.js';

describe('PREP_HOOKS registry', () => {
  it('contains a registered hook for every entry.prep referenced by the manifest', () => {
    // Catches typos in either the manifest's `prep` field or the registry key
    // at module load, instead of failing mid-build for whichever skill ships first.
    const referenced = MANIFEST.map(e => e.prep).filter(Boolean);
    for (const name of referenced) {
      assert.equal(
        typeof PREP_HOOKS[name], 'function',
        `manifest references prep hook "${name}" but no function is registered for it`
      );
    }
  });

  it('every registered hook exports a callable function', () => {
    for (const [name, fn] of Object.entries(PREP_HOOKS)) {
      assert.equal(typeof fn, 'function', `PREP_HOOKS["${name}"] is not a function`);
    }
  });

  it('returns undefined for an unregistered name (so buildOne throws on lookup)', () => {
    // The "unknown prep hook" error path in index.js#buildOne depends on this
    // lookup returning undefined for missing keys. If this assumption ever
    // changes (e.g. someone wraps the registry in a Proxy), the runtime check
    // would silently break.
    assert.equal(PREP_HOOKS['no-such-hook'], undefined);
  });
});
