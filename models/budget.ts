/**
 * Budget Control System - Data Models
 * 
 * These interfaces define the Firestore document structure for
 * budget tracking and transaction management.
 * 
 * Budget Structure:
 * - Monthly limits with weekly breakdown
 * - Yearly fiscal summary calculated from monthly budgets
 */

/**
 * Weekly spending breakdown within a month
 */
export interface WeeklySpent {
  /** Week 1: Days 1-7 */
  week1: number;
  /** Week 2: Days 8-14 */
  week2: number;
  /** Week 3: Days 15-21 */
  week3: number;
  /** Week 4: Days 22-28 */
  week4: number;
  /** Week 5: Days 29-31 (remaining days) */
  week5: number;
}

/**
 * Budget Document in Firestore
 * Collection: 'budgets'
 * Document ID: ${businessUnitId}_${coaId}_${fiscalYear}_${month}
 * 
 * This ensures uniqueness per Business Unit + COA + Year + Month combination.
 */
export interface Budget {
  /** Business Unit ID (e.g., 'IT', 'Sales', 'HR') */
  businessUnitId: string;

  /** Chart of Account ID from chart_of_accounts collection */
  coaId: string;

  /** Fiscal year (e.g., 2026) */
  fiscalYear: number;

  /** Month (1-12) */
  month: number;

  /** Maximum budget amount for this month */
  totalLimit: number;

  /** Amount already spent against this budget (total for month) */
  currentSpent: number;

  /** Weekly spending breakdown */
  weeklySpent: WeeklySpent;

  /** Currency code (e.g., 'PHP', 'USD') */
  currency: string;

  /** Timestamp when budget was created */
  createdAt?: FirebaseFirestore.Timestamp;

  /** Timestamp when budget was last updated */
  updatedAt?: FirebaseFirestore.Timestamp;

  /** User ID who created this budget */
  createdBy?: string;

  /** User ID who last updated this budget */
  updatedBy?: string;
}

/**
 * Yearly Fiscal Summary (computed from monthly budgets)
 * This is NOT stored in Firestore - it's calculated client-side
 */
export interface YearlyFiscalSummary {
  businessUnitId: string;
  coaId: string;
  fiscalYear: number;
  /** Sum of all monthly limits */
  totalYearlyLimit: number;
  /** Sum of all monthly spending */
  totalYearlySpent: number;
  /** Yearly utilization percentage */
  utilizationPercent: number;
  /** Monthly breakdown */
  monthlyBudgets: Budget[];
}

/**
 * Transaction Document in Firestore
 * Collection: 'transactions'
 * 
 * Represents a financial transaction that affects a budget.
 */
export interface Transaction {
  /** Firestore document ID (auto-generated) */
  id?: string;

  /** Transaction amount */
  amount: number;

  /** Business Unit ID */
  businessUnitId: string;

  /** Chart of Account ID */
  coaId: string;

  /** Transaction date (ISO string) */
  date: string;

  /** Server timestamp when transaction was created */
  createdAt: FirebaseFirestore.Timestamp;

  /** Reference to the budget document ID */
  budgetId: string;

  /** Week number (1-5) within the month */
  weekNumber: number;

  /** Optional description of the transaction */
  description?: string;
}

/**
 * Helper function to generate composite budget document ID
 */
export function getBudgetDocId(
  businessUnitId: string,
  coaId: string,
  fiscalYear: number,
  month: number
): string {
  return `${businessUnitId}_${coaId}_${fiscalYear}_${month.toString().padStart(2, '0')}`;
}

/**
 * Helper function to determine week number from day of month
 */
export function getWeekNumber(dayOfMonth: number): number {
  if (dayOfMonth <= 7) return 1;
  if (dayOfMonth <= 14) return 2;
  if (dayOfMonth <= 21) return 3;
  if (dayOfMonth <= 28) return 4;
  return 5;
}

/**
 * Helper function to get week key for weeklySpent object
 */
export function getWeekKey(weekNumber: number): keyof WeeklySpent {
  return `week${weekNumber}` as keyof WeeklySpent;
}

/**
 * Create empty weekly spent object
 */
export function createEmptyWeeklySpent(): WeeklySpent {
  return {
    week1: 0,
    week2: 0,
    week3: 0,
    week4: 0,
    week5: 0,
  };
}

/**
 * Input schema for setBudgetLimit Cloud Function
 */
export interface SetBudgetLimitInput {
  businessUnitId: string;
  coaId: string;
  limitAmount: number;
  fiscalYear: number;
  month: number;
  currency?: string;
}

/**
 * Input schema for postTransaction Cloud Function
 */
export interface PostTransactionInput {
  amount: number;
  businessUnitId: string;
  coaId: string;
  date: string;
  description?: string;
}

/**
 * Response from setBudgetLimit Cloud Function
 */
export interface SetBudgetLimitResponse {
  success: boolean;
  budgetId: string;
  action: 'created' | 'updated';
}

/**
 * Response from postTransaction Cloud Function
 */
export interface PostTransactionResponse {
  success: boolean;
  transactionId: string;
  newBalance: number;
}

/**
 * Month names for display
 */
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
