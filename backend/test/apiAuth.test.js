import test from 'node:test';
import assert from 'node:assert/strict';

const buildResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  return response;
};

const importApiAuthModule = async (label) => {
  const moduleUrl = new URL('../src/middleware/apiAuth.js', import.meta.url);
  moduleUrl.searchParams.set('case', label);
  moduleUrl.searchParams.set('ts', String(Date.now()));
  return import(moduleUrl);
};

test('validateApiKey accepts the development fallback outside production', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiKey = process.env.API_KEY;

  process.env.NODE_ENV = 'development';
  delete process.env.API_KEY;

  const { validateApiKey } = await importApiAuthModule('dev-fallback');

  const req = {
    method: 'GET',
    headers: {
      'x-api-key': 'dev-key-for-local-testing',
    },
  };
  const res = buildResponse();
  let calledNext = false;

  validateApiKey(req, res, () => {
    calledNext = true;
  });

  assert.equal(calledNext, true);
  assert.equal(res.statusCode, 200);

  process.env.NODE_ENV = originalNodeEnv;
  if (originalApiKey === undefined) {
    delete process.env.API_KEY;
  } else {
    process.env.API_KEY = originalApiKey;
  }
});

test('validateApiKey fails closed when production API_KEY is missing', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiKey = process.env.API_KEY;

  process.env.NODE_ENV = 'production';
  delete process.env.API_KEY;

  const { validateApiKey } = await importApiAuthModule('prod-missing-key');

  const req = {
    method: 'GET',
    headers: {
      'x-api-key': 'dev-key-for-local-testing',
    },
  };
  const res = buildResponse();
  let calledNext = false;

  validateApiKey(req, res, () => {
    calledNext = true;
  });

  assert.equal(calledNext, false);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { message: 'API authentication is not configured.' });

  process.env.NODE_ENV = originalNodeEnv;
  if (originalApiKey === undefined) {
    delete process.env.API_KEY;
  } else {
    process.env.API_KEY = originalApiKey;
  }
});
