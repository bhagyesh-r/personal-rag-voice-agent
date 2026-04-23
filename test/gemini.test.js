import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateContentWithRetry,
  normalizeGeminiError
} from '../src/services/gemini.js';

function overloadedError() {
  return new Error(
    JSON.stringify({
      error: {
        code: 503,
        message:
          'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
        status: 'UNAVAILABLE'
      }
    })
  );
}

test('generateContentWithRetry retries transient Gemini overloads and eventually succeeds', async () => {
  const calls = [];
  const delays = [];

  const response = await generateContentWithRetry({
    model: 'gemini-2.5-flash',
    maxRetries: 3,
    baseDelayMs: 100,
    contents: 'hello',
    random: () => 0,
    sleep: async (ms) => {
      delays.push(ms);
    },
    generateContent: async ({ model }) => {
      calls.push(model);

      if (calls.length < 3) {
        throw overloadedError();
      }

      return { text: 'ok' };
    }
  });

  assert.equal(response.text, 'ok');
  assert.deepEqual(calls, [
    'gemini-2.5-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash'
  ]);
  assert.deepEqual(delays, [100, 200]);
});

test('generateContentWithRetry uses the fallback model after primary retries are exhausted', async () => {
  const calls = [];
  const delays = [];

  const response = await generateContentWithRetry({
    model: 'gemini-2.5-flash',
    fallbackModel: 'gemini-2.0-flash',
    maxRetries: 1,
    baseDelayMs: 100,
    contents: 'hello',
    random: () => 0,
    sleep: async (ms) => {
      delays.push(ms);
    },
    generateContent: async ({ model }) => {
      calls.push(model);

      if (model === 'gemini-2.5-flash') {
        throw overloadedError();
      }

      return { text: 'fallback-ok' };
    }
  });

  assert.equal(response.text, 'fallback-ok');
  assert.deepEqual(calls, [
    'gemini-2.5-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash'
  ]);
  assert.deepEqual(delays, [100]);
});

test('generateContentWithRetry returns a friendly 503 error after repeated overloads', async () => {
  await assert.rejects(
    () =>
      generateContentWithRetry({
        model: 'gemini-2.5-flash',
        maxRetries: 1,
        baseDelayMs: 100,
        contents: 'hello',
        random: () => 0,
        sleep: async () => {},
        generateContent: async () => {
          throw overloadedError();
        }
      }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(
        error.message,
        'The language model is temporarily overloaded. Please retry in a moment.'
      );
      assert.equal(error.details.providerStatus, 'UNAVAILABLE');
      return true;
    }
  );
});

test('normalizeGeminiError cleans up stringified provider payloads', () => {
  const error = normalizeGeminiError(overloadedError(), 'fallback');

  assert.deepEqual(error, {
    statusCode: 503,
    message: 'The language model is temporarily overloaded. Please retry in a moment.',
    details: {
      type: 'internal_error',
      requestId: null,
      providerStatus: 'UNAVAILABLE'
    }
  });
});
