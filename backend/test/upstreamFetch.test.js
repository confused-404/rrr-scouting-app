import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchJsonWithTimeout } from '../src/utils/upstreamFetch.js';

test('fetchJsonWithTimeout returns parsed JSON for successful upstream responses', async () => {
  const data = await fetchJsonWithTimeout({
    url: 'https://example.com/api',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ status: 'ok' }),
    }),
  });

  assert.deepEqual(data, { status: 'ok' });
});

test('fetchJsonWithTimeout maps upstream HTTP failures to structured errors', async () => {
  await assert.rejects(
    () => fetchJsonWithTimeout({
      url: 'https://example.com/api',
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        text: async () => 'temporarily unavailable',
      }),
    }),
    (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.body, 'temporarily unavailable');
      assert.match(error.message, /Upstream API error: 503/);
      return true;
    },
  );
});

test('fetchJsonWithTimeout maps aborted requests to gateway timeout errors', async () => {
  await assert.rejects(
    () => fetchJsonWithTimeout({
      url: 'https://example.com/api',
      timeoutMs: 10,
      fetchImpl: async (_url, { signal }) => new Promise((_, reject) => {
        signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      }),
    }),
    (error) => {
      assert.equal(error.status, 504);
      assert.equal(error.message, 'Upstream request timed out');
      return true;
    },
  );
});

test('fetchJsonWithTimeout maps transport failures to bad gateway errors', async () => {
  await assert.rejects(
    () => fetchJsonWithTimeout({
      url: 'https://example.com/api',
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    }),
    (error) => {
      assert.equal(error.status, 502);
      assert.equal(error.message, 'Upstream request failed');
      return true;
    },
  );
});
