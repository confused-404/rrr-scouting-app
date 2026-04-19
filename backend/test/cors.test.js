import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAllowedCorsOrigins, isAllowedCorsOrigin } from '../src/utils/cors.js';

test('buildAllowedCorsOrigins includes local development defaults', () => {
  const origins = buildAllowedCorsOrigins();

  assert.ok(origins.includes('http://localhost:3000'));
  assert.ok(origins.includes('http://localhost:5173'));
});

test('isAllowedCorsOrigin accepts exact configured origins and rejects others', () => {
  const allowedOrigins = [
    'https://rrr-scouting.example.com',
    'https://preview-app.example.vercel.app',
  ];

  assert.equal(isAllowedCorsOrigin('https://rrr-scouting.example.com', allowedOrigins), true);
  assert.equal(isAllowedCorsOrigin('https://preview-app.example.vercel.app', allowedOrigins), true);
  assert.equal(isAllowedCorsOrigin('https://evil.example.com', allowedOrigins), false);
});
