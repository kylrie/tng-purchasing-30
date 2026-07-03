/**
 * TransactionHistoryView
 * 
 * Page showing all budget transactions with filters.
 * Displays: Date, PRF ID, COA, Amount, Business Unit, Status
 */

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { COLLECTIONS, type ChartOfAccount } from '../../../shared/types/firebase.types';
import type { Business } from '../../procurement/types';
import { useAuth } from '../../../contexts/useAuth';
import { SystemRole } from '../../procurement/types';
import { DateRangeFilter } from '../../../shared/components/DateRangeFilter';
import './TransactionHistoryView.css';

interface Transaction {
    id: string;
    amount: number;
    coaId: string;
    businessUnitId: string;
    date: string;
    description: string;
    createdAt: string;
    createdBy?: string;
    type?: 'debit' | 'credit';
    status?: string;
    requisitionId?: string;
}

interface TransactionHistoryViewProps {
    businesses: Business[];
}

export const TransactionHistoryView: React.FC<TransactionHistoryViewProps> = ({ businesses }) => {
    const { currentUser } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [selectedBu, setSelectedBu] = useState<string>('');
    const [selectedCoa, setSelectedCoa] = useState<string>('');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const [pageSize] = useState(50);

    // COA lookup
    const [coaMap, setCoaMap] = useState<Map<string, string>>(new Map());
    const [coaList, setCoaList] = useState<{ code: string; name: string }[]>([]);

    // Fetch COA data
    useEffect(() => {
        const fetchCoa = async () => {
            try {
                const snapshot = await getDocs(collection(db, COLLECTIONS.CHART_OF_ACCOUNTS));
                const map = new Map<string, string>();
                const list: { code: string; name: string }[] = [];
                snapshot.docs.forEach(doc => {
                    const data = doc.data() as ChartOfAccount;
                    map.set(doc.id, data.name || doc.id);
                    list.push({ code: doc.id, name: data.name || doc.id });
                });
                setCoaMap(map);
                setCoaList(list.sort((a, b) => a.code.localeCompare(b.code)));
            } catch (err) {
                console.error('Error fetching COA:', err);
            }
        };
        fetchCoa();
    }, []);

    // Fetch transactions
    useEffect(() => {
        const fetchTransactions = async () => {
            setLoading(true);
            setError(null);

            try {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                const constraints: any[] = [];

                // Filter by business unit
                if (selectedBu) {
                    constraints.push(where('businessUnitId', '==', selectedBu));
                } else if (currentUser?.role !== SystemRole.SUPER_ADMIN && currentUser?.businessId) {
                    constraints.push(where('businessUnitId', '==', currentUser.businessId));
                }

                // Filter by COA
                if (selectedCoa) {
                    constraints.push(where('coaId', '==', selectedCoa));
                }

                const q = query(
                    collection(db, COLLECTIONS.TRANSACTIONS),
                    ...constraints,
                    orderBy('createdAt', 'desc'),
                    limit(pageSize)
                );

                const snapshot = await getDocs(q);
                const txList: Transaction[] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                } as Transaction));

                // Client-side date filtering
                let filtered = txList;
                if (dateFrom) {
                    const fromDate = new Date(dateFrom);
                    filtered = filtered.filter(tx => new Date(tx.date || tx.createdAt) >= fromDate);
                }
                if (dateTo) {
                    const toDate = new Date(dateTo);
                    toDate.setHours(23, 59, 59, 999);
                    filtered = filtered.filter(tx => new Date(tx.date || tx.createdAt) <= toDate);
                }

                setTransactions(filtered);
            } catch (err) {
                console.error('Error fetching transactions:', err);
                setError('Failed to load transactions');
            } finally {
                setLoading(false);
            }
        };

        fetchTransactions();
    }, [selectedBu, selectedCoa, dateFrom, dateTo, pageSize, currentUser]);

    // Helpers
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const getBusinessName = (id: string) => {
        const business = businesses.find(b => b.id === id);
        return business?.name || id;
    };

    const getCoaName = (id: string) => {
        return coaMap.get(id) || id;
    };

    const totalTransactions = transactions.length;
    const totalAmount = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    return (
        <div className="transaction-history-view">
            <div className="transaction-header">
                <h2>Transaction History</h2>
                <p className="transaction-subtitle">Budget transactions across all accounts</p>
            </div>

            {/* Filters */}
            <div className="transaction-filters">
                <div className="filter-group">
                    <label>Business Unit</label>
                    <select
                        value={selectedBu}
                        onChange={e => setSelectedBu(e.target.value)}
                    >
                        <option value="">All Business Units</option>
                        {businesses.map(bu => (
                            <option key={bu.id} value={bu.id}>{bu.name}</option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label>COA</label>
                    <select
                        value={selectedCoa}
                        onChange={e => setSelectedCoa(e.target.value)}
                    >
                        <option value="">All Accounts</option>
                        {coaList.map(coa => (
                            <option key={coa.code} value={coa.code}>
                                {coa.code} - {coa.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label>Date Range</label>
                    <DateRangeFilter
                        onFilterChange={(start, end) => {
                            setDateFrom(start || '');
                            setDateTo(end || '');
                        }}
                    />
                </div>
            </div>

            {/* Summary */}
            <div className="transaction-summary">
                <div className="summary-stat">
                    <span className="stat-label">Total Transactions</span>
                    <span className="stat-value">{totalTransactions}</span>
                </div>
                <div className="summary-stat">
                    <span className="stat-label">Total Amount</span>
                    <span className="stat-value amount">{formatCurrency(totalAmount)}</span>
                </div>
            </div>

            {/* Table */}
            <div className="transaction-table-container">
                {loading && (
                    <div className="table-loading">
                        <div className="loading-spinner" />
                        <span>Loading transactions...</span>
                    </div>
                )}

                {error && (
                    <div className="table-error">
                        <span>⚠️ {error}</span>
                    </div>
                )}

                {!loading && !error && transactions.length === 0 && (
                    <div className="table-empty">
                        <span>No transactions found</span>
                    </div>
                )}

                {!loading && !error && transactions.length > 0 && (
                    <table className="transaction-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>PRF ID</th>
                                <th>COA</th>
                                <th>Business Unit</th>
                                <th>Description</th>
                                <th className="amount-col">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map(tx => (
                                <tr key={tx.id}>
                                    <td className="date-cell">{formatDate(tx.date || tx.createdAt)}</td>
                                    <td className="prf-cell">{tx.requisitionId || '-'}</td>
                                    <td className="coa-cell">
                                        <span className="coa-code">{tx.coaId}</span>
                                        <span className="coa-name">{getCoaName(tx.coaId)}</span>
                                    </td>
                                    <td className="bu-cell">{getBusinessName(tx.businessUnitId)}</td>
                                    <td className="desc-cell">{tx.description || '-'}</td>
                                    <td className="amount-cell">{formatCurrency(tx.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default TransactionHistoryView;
