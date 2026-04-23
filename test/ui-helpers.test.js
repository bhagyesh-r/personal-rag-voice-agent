import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePayloadObjects, formatRelativeTime } from '../public/uiHelpers.js';

test('formatRelativeTime returns short uppercase labels', () => {
  const now = new Date('2026-04-23T12:00:00.000Z').getTime();

  assert.equal(formatRelativeTime('2026-04-23T11:59:40.000Z', now), 'JUST NOW');
  assert.equal(formatRelativeTime('2026-04-23T11:58:00.000Z', now), '2 MINS AGO');
  assert.equal(formatRelativeTime('2026-04-23T10:00:00.000Z', now), '2 HRS AGO');
  assert.equal(formatRelativeTime('2026-04-20T12:00:00.000Z', now), '3 DAYS AGO');
});

test('derivePayloadObjects keeps uploaded document first and deduplicates sources', () => {
  const payloads = derivePayloadObjects(
    [
      { sourceName: 'handbook.pdf', page: 4, chunk: 2 },
      { sourceName: 'handbook.pdf', page: 5, chunk: 1 },
      { sourceName: 'compliance.docx', page: 9 }
    ],
    { documentName: 'handbook.pdf', pages: 12, chunks: 33 }
  );

  assert.deepEqual(payloads, [
    {
      label: 'handbook.pdf',
      description: 'Indexed handbook · 12 pages · 33 chunks',
      icon: 'description'
    },
    {
      label: 'compliance.docx',
      description: 'Referenced in active answer · Page 9',
      icon: 'shield'
    }
  ]);
});
