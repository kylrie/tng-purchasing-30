// Pure tests for the order-status timeline decision. Run: npx tsx --test <thisfile>
//
// Guards the P0 invariant: the "Payment confirmed" timeline node (index 1) may
// ONLY be shown as completed/active when paymentStatus === 'PAID'. An order that
// is AWAITING_PAYMENT / UNPAID (or any non-paid state) must never render as paid.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presentTimeline, PAYMENT_STEP_INDEX, presentStatus } from './qrOrderPresenter';
import type { QrOrderStatus, QrPaymentStatus } from '../types/qrOrder.types';

test('AWAITING_PAYMENT + UNPAID (the QR-00019 case) → not confirmed, capped at payment step', () => {
    const t = presentTimeline('AWAITING_PAYMENT', 'UNPAID');
    assert.equal(t.paymentConfirmed, false);
    assert.equal(t.currentStep, PAYMENT_STEP_INDEX); // received done, payment is the current pending node
});

test('AWAITING_PAYMENT + AWAITING_PAYMENT (session in flight) → still not confirmed', () => {
    const t = presentTimeline('AWAITING_PAYMENT', 'AWAITING_PAYMENT');
    assert.equal(t.paymentConfirmed, false);
    assert.equal(t.currentStep, PAYMENT_STEP_INDEX);
});

test('PAID + PAID → confirmed, advances past the payment node', () => {
    const t = presentTimeline('PAID', 'PAID');
    assert.equal(t.paymentConfirmed, true);
    assert.equal(t.currentStep, 2);
    assert.ok(t.currentStep > PAYMENT_STEP_INDEX);
});

test('later lifecycle with PAID keeps the real (uncapped) step', () => {
    assert.deepEqual(presentTimeline('IN_KITCHEN', 'PAID'), { currentStep: 2, paymentConfirmed: true });
    assert.deepEqual(presentTimeline('READY', 'PAID'), { currentStep: 3, paymentConfirmed: true });
    assert.deepEqual(presentTimeline('SERVED', 'PAID'), { currentStep: 4, paymentConfirmed: true });
    assert.deepEqual(presentTimeline('COMPLETED', 'PAID'), { currentStep: 5, paymentConfirmed: true });
});

test('INVARIANT: no non-PAID payment status ever confirms or advances past the payment node', () => {
    const statuses: QrOrderStatus[] = [
        'AWAITING_PAYMENT', 'PAID', 'IN_KITCHEN', 'IN_BAR', 'READY', 'SERVED', 'COMPLETED',
        'PAYMENT_FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED',
    ];
    const nonPaid: (QrPaymentStatus | string | undefined)[] = [
        'UNPAID', 'AWAITING_PAYMENT', 'FAILED', 'EXPIRED', 'REFUNDED', undefined, '',
    ];
    for (const s of statuses) {
        for (const ps of nonPaid) {
            const t = presentTimeline(s, ps);
            assert.equal(t.paymentConfirmed, false, `${s}/${ps} must not be confirmed`);
            assert.ok(t.currentStep <= PAYMENT_STEP_INDEX, `${s}/${ps} must not advance past the payment node (got ${t.currentStep})`);
        }
    }
});

test('inconsistent data (status advanced but not PAID) still refuses to confirm payment', () => {
    // Defensive: even if the order status somehow reads IN_KITCHEN/READY while the
    // authoritative paymentStatus is not PAID, the timeline never claims payment.
    assert.deepEqual(presentTimeline('IN_KITCHEN', 'UNPAID'), { currentStep: PAYMENT_STEP_INDEX, paymentConfirmed: false });
    assert.deepEqual(presentTimeline('SERVED', 'AWAITING_PAYMENT'), { currentStep: PAYMENT_STEP_INDEX, paymentConfirmed: false });
});

test('PAID timeline never regresses below what the status implies', () => {
    // Sanity: for PAID states, currentStep matches the raw status step.
    for (const s of ['PAID', 'IN_KITCHEN', 'READY', 'SERVED', 'COMPLETED'] as QrOrderStatus[]) {
        assert.equal(presentTimeline(s, 'PAID').currentStep, presentStatus(s).step);
    }
});
