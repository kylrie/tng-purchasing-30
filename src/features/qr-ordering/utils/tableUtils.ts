export function formatTableLabel(tableNumber: string | undefined | null): string {
    if (!tableNumber) return '';
    const lower = tableNumber.toLowerCase();
    const isSpecial = ['takeout', 'walk-in', 'walkin', 'counter', 'bar', 'pickup', 'online'].some(keyword => lower.includes(keyword));
    return isSpecial ? tableNumber : `Table ${tableNumber}`;
}
