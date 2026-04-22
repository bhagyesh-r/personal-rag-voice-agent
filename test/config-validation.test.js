import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function runValidation(envOverrides) {
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
        process.env.EMBEDDING_BASE_URL = ${JSON.stringify(envOverrides.EMBEDDING_BASE_URL)};
        process.env.EMBEDDING_MODEL = ${JSON.stringify(envOverrides.EMBEDDING_MODEL)};
        const mod = await import('./src/config.js');
        mod.validateConfig();
        console.log('ok');
      `
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8'
    }
  );
}

test('accepts the raw OpenAI embedding model id', () => {
  const result = runValidation({
    EMBEDDING_BASE_URL: 'https://api.openai.com/v1',
    EMBEDDING_MODEL: 'text-embedding-3-small'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ok/);
});

test('rejects provider-prefixed OpenAI embedding model ids', () => {
  const result = runValidation({
    EMBEDDING_BASE_URL: 'https://api.openai.com/v1',
    EMBEDDING_MODEL: 'openai/text-embedding-3-small'
  });

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Invalid EMBEDDING_MODEL "openai\/text-embedding-3-small" for OpenAI/
  );
});
