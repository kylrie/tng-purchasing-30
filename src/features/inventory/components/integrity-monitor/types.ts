export interface KpiItem {
  id: string;
  label: string;
  value: string;
  rawValue: number;
  subtext: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  isVariance?: boolean;
  variancePercent?: number;
}

export interface CategoryRisk {
  id: string;
  name: string;
  icon: React.ElementType;
  variance: number;
  sales: string;
  loss: string;
  expected: string;
  actual: string;
}

export interface SuspiciousRow {
  id: string;
  item: string;
  category: string;
  open: number;
  recv: number;
  sold: number;
  expClose: number;
  actClose: number;
  varQty: number;
  varPeso: number;
  status: 'Investigate' | 'Watch' | 'Normal';
}
