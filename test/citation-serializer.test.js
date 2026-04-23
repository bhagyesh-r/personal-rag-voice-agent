import test from 'node:test';
import assert from 'node:assert/strict';
import { getSourceName, serializeCitation } from '../src/services/citationSerializer.js';

test('getSourceName prefers stored sourceName and falls back to basename', () => {
  assert.equal(getSourceName({ sourceName: 'employee-handbook.pdf' }), 'employee-handbook.pdf');
  assert.equal(getSourceName({ source: '/tmp/uploads/abc123.pdf' }), 'abc123.pdf');
  assert.equal(getSourceName({}), 'Unknown document');
});

test('serializeCitation preserves excerpt and metadata for the UI', () => {
  const citation = serializeCitation(
    {
      score: 0.91342,
      metadata: {
        text: 'Hybrid work requires three in-office days.',
        page: 7,
        chunk: 3,
        sourceName: 'Q3-Workforce-Strat.pdf'
      }
    },
    0
  );

  assert.deepEqual(citation, {
    id: 1,
    page: 7,
    chunk: 3,
    score: 0.91342,
    text: 'Hybrid work requires three in-office days.',
    sourceName: 'Q3-Workforce-Strat.pdf'
  });
});
