import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTicket } from '../escpos';

const AT = new Date('2026-07-08T10:30:00Z').getTime();

function base() {
    return {
        orderNumber: 'QR-00042', tableNumber: '7', station: 'KITCHEN' as const,
        lines: [{ qty: 2, name: 'Sisig' }], paid: true, atMillis: AT,
    };
}

test('buildTicket starts with ESC @ (init) and ends with the full-cut command', () => {
    const b = buildTicket(base());
    assert.equal(b[0], 0x1b);
    assert.equal(b[1], 0x40);
    const tail = [...b.subarray(b.length - 4)];
    assert.deepEqual(tail, [0x1d, 0x56, 0x41, 0x00]); // GS V A 0 — full cut
});

test('buildTicket contains order number, table, station, item, and PAID', () => {
    const s = buildTicket(base()).toString('utf8');
    assert.match(s, /QR-00042/);
    assert.match(s, /TABLE 7/);
    assert.match(s, /KITCHEN/);
    assert.match(s, /2x Sisig/);
    assert.match(s, /PAID/);
    assert.doesNotMatch(s, /UNPAID/);
});

test('buildTicket marks UNPAID and REPRINT when requested', () => {
    const s = buildTicket({ ...base(), paid: false, isReprint: true }).toString('utf8');
    assert.match(s, /UNPAID/);
    assert.match(s, /\*\* REPRINT \*\*/);
});

test('buildTicket includes a NOTES block when a line has a note', () => {
    const s = buildTicket({ ...base(), lines: [{ qty: 1, name: 'Sisig', note: 'extra spicy' }] }).toString('utf8');
    assert.match(s, /NOTES:/);
    assert.match(s, /extra spicy/);
});

test('a BAR ticket names the BAR station', () => {
    const s = buildTicket({ ...base(), station: 'BAR', lines: [{ qty: 3, name: 'San Miguel' }] }).toString('utf8');
    assert.match(s, /BAR/);
    assert.match(s, /3x San Miguel/);
});
