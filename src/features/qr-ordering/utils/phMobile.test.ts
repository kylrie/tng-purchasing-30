// Pure tests for PH mobile normalize/validate. Run: npx tsx --test <thisfile>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhMobile, isValidPhMobile } from './phMobile';

test('accepts local 09XXXXXXXXX', () => {
    assert.equal(normalizePhMobile('09171234567'), '09171234567');
    assert.equal(normalizePhMobile('0917 123 4567'), '09171234567');
    assert.equal(normalizePhMobile('0917-123-4567'), '09171234567');
});

test('accepts +63 / 63 international forms → local', () => {
    assert.equal(normalizePhMobile('+639171234567'), '09171234567');
    assert.equal(normalizePhMobile('+63 917 123 4567'), '09171234567');
    assert.equal(normalizePhMobile('639171234567'), '09171234567');
});

test('rejects invalid numbers', () => {
    assert.equal(normalizePhMobile('12345'), null);
    assert.equal(normalizePhMobile('0817123456'), null);   // wrong prefix / length
    assert.equal(normalizePhMobile('091712345678'), null); // too long
    assert.equal(normalizePhMobile('0917123456'), null);   // too short
    assert.equal(normalizePhMobile(''), null);
    assert.equal(normalizePhMobile(undefined as unknown), null);
    assert.equal(normalizePhMobile('+1 555 123 4567'), null);
});

test('isValidPhMobile mirrors normalize', () => {
    assert.equal(isValidPhMobile('0917 123 4567'), true);
    assert.equal(isValidPhMobile('nope'), false);
});
