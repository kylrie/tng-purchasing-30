// Pure tests for the customer-menu URL builder. Run: npx tsx --test <thisfile>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomerMenuUrl, isFunRoofQrBusiness, FUN_ROOF_BUSINESS_ID } from './customerMenuUrl';

const ORIGIN = 'https://tng-systems.web.app';

test('Fun Roof (b1) tables encode /funroof/<qrToken>', () => {
    assert.equal(FUN_ROOF_BUSINESS_ID, 'b1');
    assert.equal(isFunRoofQrBusiness('b1'), true);
    assert.equal(buildCustomerMenuUrl(ORIGIN, 'b1', '1', 'GEpehNX1sFerRiWSpq'), `${ORIGIN}/funroof/GEpehNX1sFerRiWSpq`);
});

test('other businesses encode the token-based /order/<qrToken> route', () => {
    assert.equal(isFunRoofQrBusiness('b3'), false);
    assert.equal(buildCustomerMenuUrl(ORIGIN, 'b3', '1', 'TOKENxyz'), `${ORIGIN}/order/TOKENxyz`);
});

test('no token yet → empty (link/QR not shown until the token loads)', () => {
    assert.equal(buildCustomerMenuUrl(ORIGIN, 'b1', '1', ''), '');
    assert.equal(buildCustomerMenuUrl(ORIGIN, 'b3', '1', ''), '');
});

test('token is URL-encoded', () => {
    assert.equal(buildCustomerMenuUrl(ORIGIN, 'b1', '1', 'a/b c'), `${ORIGIN}/funroof/a%2Fb%20c`);
});
