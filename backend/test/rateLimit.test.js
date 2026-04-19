import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/middleware/rateLimit.js';

const createResponseRecorder = () => {
  const headers = new Map();
  return {
    statusCode: 200,
    body: null,
    set(name, value) {
      headers.set(name, value);
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    getHeader(name) {
      return headers.get(name);
    },
  };
};

test('createRateLimiter blocks requests after the configured limit per key', () => {
  let currentTime = 1_000;
  let nextCount = 0;
  const limiter = createRateLimiter({
    windowMs: 10_000,
    maxRequests: 2,
    keyResolver: (req) => req.ip,
    now: () => currentTime,
  });

  const invoke = (ip) => {
    const res = createResponseRecorder();
    const req = { ip };
    limiter(req, res, () => {
      nextCount += 1;
    });
    return res;
  };

  const firstResponse = invoke('127.0.0.1');
  const secondResponse = invoke('127.0.0.1');
  const thirdResponse = invoke('127.0.0.1');

  assert.equal(nextCount, 2);
  assert.equal(firstResponse.getHeader('X-RateLimit-Remaining'), '1');
  assert.equal(secondResponse.getHeader('X-RateLimit-Remaining'), '0');
  assert.equal(thirdResponse.statusCode, 429);
  assert.deepEqual(thirdResponse.body, {
    message: 'Too many requests. Please try again later.',
  });
  assert.equal(thirdResponse.getHeader('Retry-After'), '10');
});

test('createRateLimiter isolates counters by resolved key and resets after the window', () => {
  let currentTime = 5_000;
  let nextCount = 0;
  const limiter = createRateLimiter({
    windowMs: 1_000,
    maxRequests: 1,
    keyResolver: (req) => req.user?.uid || req.ip,
    now: () => currentTime,
  });

  const invoke = (req) => {
    const res = createResponseRecorder();
    limiter(req, res, () => {
      nextCount += 1;
    });
    return res;
  };

  const firstUserResponse = invoke({ ip: '127.0.0.1', user: { uid: 'user-1' } });
  const secondUserResponse = invoke({ ip: '127.0.0.1', user: { uid: 'user-2' } });
  const blockedResponse = invoke({ ip: '127.0.0.1', user: { uid: 'user-1' } });

  currentTime += 1_001;
  const resetResponse = invoke({ ip: '127.0.0.1', user: { uid: 'user-1' } });

  assert.equal(nextCount, 3);
  assert.equal(firstUserResponse.statusCode, 200);
  assert.equal(secondUserResponse.statusCode, 200);
  assert.equal(blockedResponse.statusCode, 429);
  assert.equal(resetResponse.statusCode, 200);
  assert.equal(resetResponse.getHeader('X-RateLimit-Remaining'), '0');
});
