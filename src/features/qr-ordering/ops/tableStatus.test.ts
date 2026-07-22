// Pure tests for the table status + reservation-window resolver. Run: npx tsx --test <thisfile>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveTableStatus, nextReservation, upcomingReservations, hasReservationConflict,
    isBlockingNow, RESERVATION_HOLD_MINUTES, type ReservationLite,
} from './tableStatus';

const NOW = 1_800_000_000_000;
const MIN = 60_000;
const HOLD = RESERVATION_HOLD_MINUTES * MIN;

const r = (id: string, atMillis: number, over: Partial<ReservationLite> = {}): ReservationLite => ({
    id, tableId: 't1', reservationAtMillis: atMillis, holdMinutes: RESERVATION_HOLD_MINUTES,
    customerName: 'Cust ' + id, customerPhone: '09171234567', ...over,
});

test('free table: no active order, no blocking reservation → FREE', () => {
    assert.equal(resolveTableStatus(false, [], NOW), 'FREE');
    assert.equal(resolveTableStatus(false, [r('a', NOW + 60 * MIN)], NOW), 'FREE'); // future-only → still FREE now
});

test('active order → OCCUPIED (takes precedence over a reservation)', () => {
    assert.equal(resolveTableStatus(true, [], NOW), 'OCCUPIED');
    assert.equal(resolveTableStatus(true, [r('a', NOW - 10 * MIN)], NOW), 'OCCUPIED'); // occupied beats reserved
});

test('reservation whose hold window covers now → RESERVED', () => {
    assert.equal(resolveTableStatus(false, [r('a', NOW - 10 * MIN)], NOW), 'RESERVED');
    // just started
    assert.equal(isBlockingNow(r('a', NOW), NOW), true);
    // window ended → no longer blocking
    assert.equal(isBlockingNow(r('a', NOW - HOLD - MIN), NOW), false);
    assert.equal(resolveTableStatus(false, [r('a', NOW - HOLD - MIN)], NOW), 'FREE');
});

test('cancelled reservation never blocks', () => {
    assert.equal(resolveTableStatus(false, [r('a', NOW - 10 * MIN, { status: 'CANCELLED' })], NOW), 'FREE');
});

test('next upcoming reservation: nearest start first', () => {
    const list = [r('far', NOW + 5 * 60 * MIN), r('near', NOW + 60 * MIN), r('mid', NOW + 2 * 60 * MIN)];
    const up = upcomingReservations(list, NOW);
    assert.deepEqual(up.map(x => x.id), ['near', 'mid', 'far']);
    assert.equal(nextReservation(list, NOW)?.id, 'near');
});

test('next upcoming reservation: a currently-blocking one is still shown first', () => {
    const list = [r('future', NOW + 3 * 60 * MIN), r('current', NOW - 5 * MIN)];
    assert.equal(nextReservation(list, NOW)?.id, 'current');
});

test('expired reservations are excluded from upcoming', () => {
    assert.equal(nextReservation([r('old', NOW - HOLD - 5 * MIN)], NOW), null);
});

test('conflict: overlapping window rejected, adjacent/clear window allowed', () => {
    const existing = [r('e', NOW + 60 * MIN)]; // window: +60m .. +180m
    assert.equal(hasReservationConflict(existing, NOW + 90 * MIN), true);   // starts inside existing window
    assert.equal(hasReservationConflict(existing, NOW + 30 * MIN), true);   // its 120m window overlaps existing start
    assert.equal(hasReservationConflict(existing, NOW + 200 * MIN), false); // clear after existing window
    assert.equal(hasReservationConflict([], NOW + 60 * MIN), false);
});
