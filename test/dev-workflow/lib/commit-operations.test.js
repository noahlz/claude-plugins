import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildCommitMessage } from '../../../plugins/dev-workflow/lib/commit-operations.js';

describe('lib/commit-operations.js', () => {
  describe('buildCommitMessage', () => {
    const base = {
      subject: 'Merge feature',
      body: null,
      method: 'merge',
      costs: [{ model: 'm', cost: 1, in: 1, out: 1 }],
      since: '2026-01-01T00:00:00Z',
      sessionId: '-proj'
    };

    // Key order is the trailer's contract, so read it from the raw JSON rather than a parse
    const trailerKeys = (message) => {
      const line = message.split('\n').find(l => l.startsWith('Claude-Cost-Metrics: '));
      return Object.keys(JSON.parse(line.slice('Claude-Cost-Metrics: '.length)));
    };

    it('writes pooled after since and before sessionId', () => {
      const message = buildCommitMessage({ ...base, pooled: ['-proj--wt'] });

      assert.deepEqual(trailerKeys(message), ['method', 'cost', 'since', 'pooled', 'sessionId']);
      assert.match(message, /"pooled":\["-proj--wt"\],"sessionId":"-proj"/);
    });

    it('omits pooled when it is empty', () => {
      const message = buildCommitMessage({ ...base, pooled: [] });

      assert.deepEqual(trailerKeys(message), ['method', 'cost', 'since', 'sessionId']);
    });
  });
});
