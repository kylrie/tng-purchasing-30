// The Fun Roof — price formatting. The bar menu spans ₱1 → ₱15,000 with the odd
// centavo price, so group thousands and only show decimals when they're non-zero.
export function peso(n: number): string {
    const hasFrac = Math.round(n * 100) % 100 !== 0;
    return '₱' + n.toLocaleString('en-PH', {
        minimumFractionDigits: hasFrac ? 2 : 0,
        maximumFractionDigits: 2,
    });
}
