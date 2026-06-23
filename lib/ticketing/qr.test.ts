// Run with: npx tsx --test lib/ticketing/qr.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractToken } from './qr';

test('extractToken: full check-in URL → token query param', () => {
  assert.equal(
    extractToken('https://retrogroove.pe/admin/check-in?token=tok-valid'),
    'tok-valid'
  );
});

test('extractToken: URL with extra params still isolates token', () => {
  assert.equal(
    extractToken('https://retrogroove.pe/admin/check-in?token=ABCD1234&utm=qr'),
    'ABCD1234'
  );
});

test('extractToken: bare token → returned as-is (trimmed)', () => {
  assert.equal(extractToken('  RG-7K4P-29  '), 'RG-7K4P-29');
});

test('extractToken: malformed / unusable value → null', () => {
  assert.equal(extractToken('http://[bad-url'), null);
  assert.equal(extractToken('https://retrogroove.pe/admin/check-in'), null);
  assert.equal(extractToken(''), null);
  assert.equal(extractToken('   '), null);
  assert.equal(extractToken(null), null);
  assert.equal(extractToken(undefined), null);
});

test('extractToken: empty token param → null (not empty string)', () => {
  assert.equal(extractToken('https://x.test/check-in?token='), null);
});
