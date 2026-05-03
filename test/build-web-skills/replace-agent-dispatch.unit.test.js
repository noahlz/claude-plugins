import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { replaceAgentDispatch } from '../../scripts/build-web-skills/replace-agent-dispatch.js';

describe('replaceAgentDispatch', () => {
  it('rewrites the canonical pattern with backticks around the name', () => {
    const out = replaceAgentDispatch(
      'Dispatch the `linkedin-reviewer` agent to review the draft.'
    );
    assert.equal(
      out,
      'Read `agents/linkedin-reviewer.md` and follow its instructions to review the draft.'
    );
  });

  it('rewrites the pattern when the name has no surrounding backticks', () => {
    const out = replaceAgentDispatch(
      'Dispatch the linkedin-reviewer agent to review the draft.'
    );
    assert.equal(
      out,
      'Read `agents/linkedin-reviewer.md` and follow its instructions to review the draft.'
    );
  });

  it('preserves the verb tail verbatim', () => {
    const out = replaceAgentDispatch(
      'Dispatch the foo agent to do a complex multi-word job.'
    );
    assert.match(out, /to do a complex multi-word job\.$/);
  });

  it('is a no-op on prose that does not match', () => {
    const text = 'Read the agent prompt and apply it.';
    assert.equal(replaceAgentDispatch(text), text);
  });

  it('rewrites multiple occurrences in a single pass', () => {
    const out = replaceAgentDispatch(
      'Dispatch the alpha agent to step one. Dispatch the `beta` agent to step two.'
    );
    assert.match(out, /Read `agents\/alpha\.md` and follow its instructions to step one\./);
    assert.match(out, /Read `agents\/beta\.md` and follow its instructions to step two\./);
  });

  it('does not match lowercase mid-sentence "dispatch"', () => {
    const text = 'You may dispatch the foo agent to do something.';
    assert.equal(replaceAgentDispatch(text), text);
  });
});
