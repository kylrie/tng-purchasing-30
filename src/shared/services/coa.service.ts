import { writeBatch, doc, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { FirestoreService } from './firestore.service';
import { COLLECTIONS, type ChartOfAccount } from '../types/firebase.types';

const COA_COLLECTION = COLLECTIONS.CHART_OF_ACCOUNTS;

/**
 * Chart of Accounts Service
 * Handles CRUD operations and batch imports for COA
 */
export class CoaService {
    /**
     * Get all accounts ordered by code
     */
    static async getAccounts(): Promise<ChartOfAccount[]> {
        const accounts = await FirestoreService.getDocuments<ChartOfAccount>(
            COA_COLLECTION,
            [orderBy('code', 'asc')]
        );
        return accounts;
    }

    /**
     * Get active accounts only (for dropdowns)
     */
    static async getActiveAccounts(): Promise<ChartOfAccount[]> {
        const accounts = await this.getAccounts();
        return accounts.filter(a => a.isActive !== false);
    }

    /**
     * Get a single account by code
     */
    static async getAccountByCode(code: string): Promise<ChartOfAccount | null> {
        return await FirestoreService.getDocument<ChartOfAccount>(COA_COLLECTION, code);
    }

    /**
     * Import accounts in batch (max 500 operations per batch)
     * Uses code as document ID - updates if exists, creates if not
     * 
     * @param accounts - Array of ChartOfAccount objects to import
     * @returns Import statistics
     */
    static async importAccountsBatch(accounts: ChartOfAccount[]): Promise<{
        imported: number;
        failed: number;
        errors: string[];
    }> {
        const BATCH_SIZE = 500;
        let imported = 0;
        let failed = 0;
        const errors: string[] = [];

        // Validate and sanitize accounts
        const validAccounts = accounts.filter(acc => {
            if (!acc.code || acc.code.trim() === '') {
                failed++;
                errors.push(`Account skipped: missing code`);
                return false;
            }
            return true;
        });

        // Process in chunks of 500
        for (let i = 0; i < validAccounts.length; i += BATCH_SIZE) {
            const chunk = validAccounts.slice(i, i + BATCH_SIZE);
            const batch = writeBatch(db);

            for (const account of chunk) {
                // Sanitize code for use as document ID (remove special chars)
                const docId = account.code.toString().trim();
                const docRef = doc(db, COA_COLLECTION, docId);

                const accountData: ChartOfAccount = {
                    code: account.code.toString().trim(),
                    name: account.name?.toString().trim() || '',
                    parentId: account.parentId?.toString().trim() || '',
                    classification: account.classification?.toString().trim() || '',
                    financialStatement: account.financialStatement?.toString().trim() || '',
                    accountType: account.accountType?.toString().trim() || '',
                    cashFlowClassification: account.cashFlowClassification?.toString().trim() || '',
                    isActive: account.isActive !== false, // Default to true
                };

                // Use set with merge to upsert (update if exists, create if not)
                batch.set(docRef, accountData, { merge: true });
            }

            try {
                await batch.commit();
                imported += chunk.length;
            } catch (error) {
                console.error('Batch import error:', error);
                failed += chunk.length;
                errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error}`);
            }
        }

        return { imported, failed, errors };
    }

    /**
     * Create or update a single account
     */
    static async upsertAccount(account: ChartOfAccount): Promise<void> {
        const docId = account.code.toString().trim();
        await FirestoreService.setDocument(COA_COLLECTION, docId, account, true);
    }

    /**
     * Delete an account by code
     */
    static async deleteAccount(code: string): Promise<void> {
        await FirestoreService.deleteDocument(COA_COLLECTION, code);
    }

    /**
     * Toggle account active status
     */
    static async toggleAccountStatus(code: string, isActive: boolean): Promise<void> {
        await FirestoreService.updateDocument(COA_COLLECTION, code, { isActive });
    }
}
