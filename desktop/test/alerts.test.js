'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { alertView, transition, xsrfHeader } = require('../src/alerts');

test('немає тривоги — оверлей ховається', () => {
    assert.strictEqual(alertView({ status: [] }), null);
    assert.strictEqual(alertView(undefined), null);
});

test('тривога: назва, рівень, місце, тривалість і колір', () => {
    const now = new Date('2026-11-21T20:00:00Z');
    const view = alertView({
        unit: { name: 'Київ' },
        shelter: true,
        status: [
            { name: 'Повітряна тривога', level: 'red', since: '2026-11-21T18:45:00Z', accent: '#DC2626' },
            { name: 'Загроза артобстрілу', since: '2026-11-21T19:50:00Z' },
        ],
    }, now);
    assert.strictEqual(view.title, 'Повітряна тривога · червоний рівень +1');
    assert.strictEqual(view.place, 'Київ');
    assert.strictEqual(view.duration, 'Триває 1 год 15 хв');
    assert.strictEqual(view.color, '#DC2626');
    assert.strictEqual(view.shelter, true);
});

test('переходи: початок, відбій, нова тривога, без змін', () => {
    const a = { key: 'x|1' };
    assert.strictEqual(transition(null, a), 'start');
    assert.strictEqual(transition(a, null), 'end');
    assert.strictEqual(transition(a, { key: 'y|2' }), 'start');
    assert.strictEqual(transition(a, { key: 'x|1' }), null);
    assert.strictEqual(transition(null, null), null);
});

test('CSRF-токен Laravel розкодовується з cookie', () => {
    assert.strictEqual(xsrfHeader('abc%3D%3D'), 'abc==');
    assert.strictEqual(xsrfHeader(undefined), null);
});
