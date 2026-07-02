import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { RunningBill, POSOrder } from '../types/pos.types';
import { Clock, ChefHat, CheckSquare } from 'lucide-react';

interface KitchenDisplayViewProps {
    businessUnitId: string;
}

type KitchenTicket = {
    id: string;
    title: string; // Table Name or Order Number
    type: 'table' | 'counter';
    items: { name: string; quantity: number; notes?: string }[];
    timestamp: Date;
    status: 'pending' | 'completed'; // Simplified status
};

export const KitchenDisplayView: React.FC<KitchenDisplayViewProps> = ({ businessUnitId }) => {
    const [tickets, setTickets] = useState<KitchenTicket[]>([]);

    useEffect(() => {
        if (!businessUnitId) return;

        const openBillsQuery = query(
            collection(db, 'pos_running_bills'),
            where('businessUnitId', '==', businessUnitId),
            where('status', '==', 'OPEN')
        );

        const counterOrdersQuery = query(
            collection(db, 'pos_orders'),
            where('businessUnitId', '==', businessUnitId),
            where('status', '==', 'COMPLETED'), // Assuming counter orders are completed when paid
            orderBy('createdAt', 'desc'),
            limit(10)
        );

        const unsubscribeBills = onSnapshot(openBillsQuery, (snapshot) => {
            const bills = snapshot.docs.map(doc => {
                const data = doc.data() as RunningBill;
                return {
                    id: doc.id,
                    title: `Table: ${data.tableName}`,
                    type: 'table' as const,
                    items: data.items.map(i => ({ name: i.productName, quantity: i.quantity, notes: i.notes })),
                    timestamp: data.updatedAt?.toDate() || new Date(),
                    status: 'pending' as const
                };
            });
            updateTickets(prev => mergeTickets(prev, bills, 'table'));
        });

        const unsubscribeOrders = onSnapshot(counterOrdersQuery, (snapshot) => {
            const orders = snapshot.docs.map(doc => {
                const data = doc.data() as POSOrder;
                return {
                    id: doc.id,
                    title: `Order: ${data.orderNumber}`,
                    type: 'counter' as const,
                    items: data.items.map(i => ({ name: i.productName, quantity: i.quantity, notes: i.notes })),
                    timestamp: data.createdAt?.toDate() || new Date(),
                    status: 'pending' as const
                };
            });
            updateTickets(prev => mergeTickets(prev, orders, 'counter'));
        });

        return () => {
            unsubscribeBills();
            unsubscribeOrders();
        };
    }, [businessUnitId]);

    // Helper to merge live streams
    const mergeTickets = (prev: KitchenTicket[], incoming: KitchenTicket[], type: 'table' | 'counter') => {
        const filtered = prev.filter(t => t.type !== type);
        return [...filtered, ...incoming].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    };

    const updateTickets = (updater: (prev: KitchenTicket[]) => KitchenTicket[]) => {
        setTickets(updater);
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
            <div className="h-16 flex items-center justify-between px-6 bg-slate-800 border-b border-slate-700 shrink-0">
                <div className="flex items-center gap-3 text-white">
                    <ChefHat className="w-6 h-6 text-amber-500" />
                    <h1 className="text-xl font-bold">Kitchen Display</h1>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
                <div className="flex gap-6 h-full items-start">
                    {tickets.map(ticket => (
                        <div key={ticket.id} className="w-80 shrink-0 bg-slate-800 rounded-2xl border border-slate-700 flex flex-col h-full max-h-full overflow-hidden shadow-xl">
                            {/* Ticket Header */}
                            <div className={`p-4 border-b ${ticket.type === 'table' ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                                <div className="flex justify-between items-center mb-1">
                                    <h3 className={`font-bold text-lg ${ticket.type === 'table' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                                        {ticket.title}
                                    </h3>
                                    <span className="text-slate-400 text-sm flex items-center gap-1">
                                        <Clock className="w-4 h-4" />
                                        {formatTime(ticket.timestamp)}
                                    </span>
                                </div>
                                <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                                    {ticket.type === 'table' ? 'Dine In' : 'Takeout / Counter'}
                                </span>
                            </div>

                            {/* Ticket Items */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {ticket.items.map((item, idx) => (
                                    <div key={idx} className="flex gap-3 text-slate-300">
                                        <div className="font-bold text-lg min-w-[2ch]">{item.quantity}x</div>
                                        <div className="flex-1">
                                            <div className="font-medium text-lg leading-tight">{item.name}</div>
                                            {item.notes && (
                                                <div className="text-sm text-amber-400/80 mt-1 italic">
                                                    Note: {item.notes}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Ticket Footer (Actions) */}
                            <div className="p-4 border-t border-slate-700 bg-slate-800/50 mt-auto">
                                <button className="w-full flex justify-center items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold py-3 rounded-xl border border-emerald-500/20 transition-colors">
                                    <CheckSquare className="w-5 h-5" />
                                    Mark Done (Local)
                                </button>
                            </div>
                        </div>
                    ))}

                    {tickets.length === 0 && (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 h-full">
                            <ChefHat className="w-16 h-16 mb-4 opacity-50" />
                            <p className="text-2xl font-bold">No Active Orders</p>
                            <p className="text-sm mt-2">Waiting for new tickets...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
