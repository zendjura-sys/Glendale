import test from 'node:test';
import assert from 'node:assert/strict';
import { isTrustedPlayerMessage } from '../../resources/app/lib/kodikMessage.ts';

test('accepts a message from the current iframe at its exact origin', () => {
  const frame = {};
  assert.equal(isTrustedPlayerMessage({ source: frame, origin: 'https://kodik.info' }, frame, 'https://kodik.info/serial/example'), true);
});
test('rejects another window even when its origin matches', () => {
  assert.equal(isTrustedPlayerMessage({ source: {}, origin: 'https://kodik.info' }, {}, 'https://kodik.info/serial/example'), false);
});
test('rejects another origin and absent frames', () => {
  const frame = {};
  assert.equal(isTrustedPlayerMessage({ source: frame, origin: 'https://attacker.example' }, frame, 'https://kodik.info/serial/example'), false);
  assert.equal(isTrustedPlayerMessage({ source: null, origin: 'https://kodik.info' }, null, 'https://kodik.info/serial/example'), false);
});
test('rejects missing or malformed player URLs', () => {
  const frame = {};
  assert.equal(isTrustedPlayerMessage({ source: frame, origin: 'https://kodik.info' }, frame, null), false);
  assert.equal(isTrustedPlayerMessage({ source: frame, origin: 'https://kodik.info' }, frame, 'invalid'), false);
});

