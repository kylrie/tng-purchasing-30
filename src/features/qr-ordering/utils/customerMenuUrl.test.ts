// Pure tests for the customer-menu URL builder. Run: npx tsx --test <thisfile>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomerMenuUrl, isFunRoofQrBusiness, FUN_ROOF_BUSINESS_ID } from './customerMenuUrl';

const ORIGIN = 'https://tng-systems.web.app';

test('Fun Roof (b1) tables link to the standalone /funroof/<tableNumber> menu', () => {
    assert.equal(FUN_ROOF_BUSINESS_ID, 'b1');
    assert.equal(isFunRoofQrBusiness('b1'), true);
    assert.equal(buildCustomerMenuUrl(ORIGIN, 'b1', '1', 'TOKENabc'), `${ORIGIN}/funroof/1`);
    assert.equal(buildCustomerMenuUrl(ORIGIN, 'b1', '12', 'TOKENabc'), `${ORIGIN}/funroof/12`);
    // Fun Roof does not need the token; URL comes from the table number.
    assert.equal(buildCustomerMenuUrl(ORIGIN, 'b1', '3', ''), `${ORIGIN}/funroof/3`);
});

test('other businesses keep the token-based /order/<token> ordering route', () => {
    assert.equal(isFunRoofQrBusiness('b3'), false);
    assert.equal(buildCustomerMenuUrl(ORIGIN, 'b3', '1', 'TOKENxyz'), `${ORIGIN}/order/TOKENxyz`);
    // No token yet → empty (the QR/link simply isn't shown until the token loads).
    assert.equal(buildCustomerMenuUrl(ORIGIN, 'b3', '1', ''), '');
});

test('Fun Roof route never leaks the token and encodes the table number', () => {
    const url = buildCustomerMenuUrl(ORIGIN, 'b1', 'A 1', 'SECRETTOKEN');
    assert.ok(!url.includes('SECRETTOKEN'));
    assert.equal(url, `${ORIGIN}/funroof/A%201`);
});
