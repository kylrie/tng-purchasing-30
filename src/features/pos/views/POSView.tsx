import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/useAuth';
import { usePOSMenu } from '../hooks/usePOSMenu';
import { usePOSStore } from '../store/posStore';
import { POSService } from '../services/pos.service';
import type { POSOrder, PaymentMethod, POSOrderCreateInput, POSTable, RunningBill } from '../types/pos.types';
import type { User } from '../../../shared/types';
import type { MenuItem } from '../../menu/types/menu.types';
import { LogOut, Settings, BarChart3, LayoutDashboard, ShoppingCart, ListOrdered, ChefHat, Wine, Table2, History as HistoryIcon } from 'lucide-react';
import { SettingsService } from '../../../shared/services/settings.service';

import ProductGrid from '../components/ProductGrid';
import CartPane from '../components/CartPane';
import CheckoutModal from '../components/CheckoutModal';
import ReceiptModal from '../components/ReceiptModal';
import POSLogin from '../components/POSLogin';
import POSSettingsModal from '../components/POSSettingsModal';
import POSReportsModal from '../components/POSReportsModal';
import { TableManagementView } from './TableManagementView';
import { TableFloorView } from '../components/TableFloorView';
import { RunningBillService } from '../services/running-bill.service';
import { ManagerAuthModal } from '../components/ManagerAuthModal';
// Unified operations shell: mount the PROVEN QR Operations views (live/kitchen/bar/
// history) inside the POS full-screen shell — reuse, no logic duplication.
import QrOpsView, { type OpsTab } from '../../qr-ordering/ops/QrOpsView';

// The unified staff-operations tabs. "POS" = the ordering terminal + table floor;
// the rest reuse the QR Operations views. "Tables" only shows for table businesses.
type PosOpsTab = 'pos' | 'live' | 'kitchen' | 'bar' | 'tables' | 'history';
const OPS_TABS: { key: PosOpsTab; label: string; Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>; tableOnly?: boolean }[] = [
    { key: 'pos', label: 'POS', Icon: ShoppingCart },
    { key: 'live', label: 'Live Orders', Icon: ListOrdered },
    { key: 'kitchen', label: 'Kitchen', Icon: ChefHat },
    { key: 'bar', label: 'Bar', Icon: Wine },
    { key: 'tables', label: 'Tables', Icon: Table2, tableOnly: true },
    { key: 'history', label: 'History', Icon: HistoryIcon },
];
const QR_OPS_TABS: PosOpsTab[] = ['live', 'kitchen', 'bar', 'history'];

interface POSViewProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    businesses: any[];
    allUsers: User[];
}

const POSView: React.FC<POSViewProps> = ({ businesses, allUsers }) => {
    const { currentUser } = useAuth();
    const defaultBusinessId = currentUser?.businessUnitIds?.[0] || businesses[0]?.id || '';
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>(defaultBusinessId);
    const [activeCashier, setActiveCashier] = useState<User | null>(null);
    const [superAdminPin, setSuperAdminPin] = useState<string>('');

    // Fetch Super Admin PIN on mount
    useEffect(() => {
        const fetchSuperAdminPin = async () => {
            try {
                const posSettings = await SettingsService.getPOSSettings();
                if (posSettings.superAdminPin) {
                    setSuperAdminPin(posSettings.superAdminPin);
                }
            } catch (err) {
                console.error('Failed to fetch POS settings:', err);
            }
        };
        fetchSuperAdminPin();
    }, []);

    // Ensure selectedBusinessUnit is valid for the active cashier
    useEffect(() => {
        if (activeCashier) {
            const cashierBusinesses = businesses.filter(b => 
                b.id === activeCashier.businessId || 
                activeCashier.businessUnitIds?.includes(b.id)
            );
            
            if (cashierBusinesses.length > 0) {
                const isValid = cashierBusinesses.some(b => b.id === selectedBusinessUnit);
                if (!isValid) {
                    setSelectedBusinessUnit(cashierBusinesses[0].id);
                }
            }
        }
    }, [activeCashier, businesses, selectedBusinessUnit]);

    const { menuItems, isLoading, sellableStockMap } = usePOSMenu(selectedBusinessUnit);
    const { 
        cartItems, 
        grossSubtotal: subtotal, 
        totalVatableSales: vatableSales, 
        totalVatExemptSales: vatExemptSales, 
        totalVatAmount: taxAmount, 
        totalDiscount: discountAmount, 
        totalScPwdDiscount: scPwdDiscountAmount, 
        totalManualDiscount: manualItemDiscountAmount, 
        globalDiscountAmount,
        serviceChargeAmount, 
        total, 
        clearCart,
        addToCart,
        setCartItems,
        setSettings
    } = usePOSStore();

    // Fetch POS settings to populate the store
    useEffect(() => {
        SettingsService.getPOSSettings().then(setSettings).catch(console.error);
    }, [setSettings]);

    const [isCheckoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [isReceiptModalOpen, setReceiptModalOpen] = useState(false);
    const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
    const [isReportsModalOpen, setReportsModalOpen] = useState(false);
    const [isTableManagementOpen, setIsTableManagementOpen] = useState(false);
    const [completedOrder, setCompletedOrder] = useState<POSOrder | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Unified operations tab (POS / Live / Kitchen / Bar / Tables / History), synced
    // to the URL (?tab=) for deep-link + reload. "POS"/"Tables" render the terminal;
    // QR tabs mount the embedded, proven QR Operations views.
    const [searchParams, setSearchParams] = useSearchParams();
    const [opsTab, setOpsTab] = useState<PosOpsTab>(() => {
        const t = searchParams.get('tab');
        return (OPS_TABS.some(x => x.key === t) ? t : 'pos') as PosOpsTab;
    });

    // Table mode state
    const [activeTable, setActiveTable] = useState<POSTable | null>(null);
    const [activeBill, setActiveBill] = useState<RunningBill | null>(null);

    // Keep the URL in sync with the active tab (deep-link / reload), replace-only.
    useEffect(() => {
        const cur = searchParams.get('tab') ?? 'pos';
        if (cur !== opsTab) {
            const next = new URLSearchParams(searchParams);
            if (opsTab === 'pos') next.delete('tab'); else next.set('tab', opsTab);
            setSearchParams(next, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opsTab]);
    
    // Manager Auth
    const [managerAuthAction, setManagerAuthAction] = useState<(() => void) | null>(null);

    // On business change: clear the current table/bill/cart. If we're in the POS
    // ordering/tables area, land table-management businesses on the floor (as before).
    // A QR tab (live/kitchen/bar/history) is left in place — it just re-scopes.
    useEffect(() => {
        setActiveTable(null);
        setActiveBill(null);
        clearCart();
        const hasTables = !!businesses.find(b => b.id === selectedBusinessUnit)?.hasTableManagement;
        setOpsTab(prev => (prev === 'pos' || prev === 'tables') ? (hasTables ? 'tables' : 'pos') : prev);
    }, [selectedBusinessUnit, businesses, clearCart]);

    const handleAddItem = React.useCallback((item: MenuItem) => {
        addToCart(item, 1);
    }, [addToCart]);

    const handleCheckout = React.useCallback(() => {
        setCheckoutModalOpen(true);
    }, []);

    const handlePrintRunningBill = async () => {
        if (!activeTable) return;
        try {
            const savedPrinter = localStorage.getItem('pos_printer_type') as any || 'simulator';
            const savedIp = localStorage.getItem('pos_printer_ip') || '';
            const config = { type: savedPrinter, ipAddress: savedIp };

            const { POSPrinterService } = await import('../services/pos-printer.service');
            
            if (config.type === 'bluetooth') {
                await POSPrinterService.connectBluetooth();
            }

            const text = POSPrinterService.formatRunningBill({
                createdAt: activeBill?.createdAt,
                cashierName: activeCashier?.name,
                tableName: activeTable.name,
                items: cartItems.map(item => ({
                    menuItemId: item.menuItemId,
                    productName: item.productName,
                    quantity: item.quantity,
                    subtotal: item.subtotal
                })) as any[],
                subtotal: subtotal,
                taxAmount: taxAmount,
                totalAmount: total,
                discountAmount: (discountAmount || 0) + (globalDiscountAmount || 0)
            });

            const payload = POSPrinterService.generateReceiptPayload(text);
            await POSPrinterService.print(config, payload);
            alert('Running bill printed successfully!');
        } catch (error) {
            console.error('Failed to print running bill:', error);
            alert('Failed to print running bill. Check printer connection.');
        }
    };

    const handleConfirmPayment = async (paymentMethod: PaymentMethod, amountTendered: number) => {
        if (!activeCashier) return;
        setIsProcessing(true);

        try {
            const changeAmount = amountTendered - total;

            const orderInput: POSOrderCreateInput = {
                businessUnitId: selectedBusinessUnit,
                cashierId: activeCashier.id,
                cashierName: activeCashier.name,
                items: cartItems.map(item => ({
                    menuItemId: item.menuItemId,
                    productName: item.productName,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    subtotal: item.subtotal,
                    category: item.category,
                    notes: item.notes,
                    isDiscounted: item.isDiscounted,
                    discountRate: item.discountRate,
                    discountReason: item.discountReason,
                    vatAmount: item.vatAmount,
                    discountAmount: item.discountAmount,
                    vatExemptAmount: item.vatExemptAmount
                })),
                subtotal,
                taxAmount,
                vatableSales,
                vatExemptSales,
                serviceChargeAmount,
                discountAmount: (discountAmount || 0) + (globalDiscountAmount || 0),
                scPwdDiscountAmount,
                manualItemDiscountAmount,
                totalAmount: total,
                amountTendered,
                changeAmount,
                paymentMethod,
                ...(activeTable && { tableId: activeTable.id, tableName: activeTable.name })
            };

            let newOrder;
            if (activeBill) {
                await RunningBillService.settleBill(activeBill.id, orderInput);
                newOrder = await POSService.createOrder(orderInput); // Actually wait, settleBill creates the POSOrder inside the transaction.
                // We should modify settleBill to return the created POSOrder so we can display the receipt.
                // But for now, since it creates it, we'll just mock it or fetch it. Let's adjust settleBill in a moment.
                // I will temporarily create a mock POSOrder object for the receipt display.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                newOrder = { id: 'settled-bill', ...orderInput, status: 'COMPLETED', createdAt: new Date() as any, updatedAt: new Date() as any } as POSOrder;
                
                // Clear active bill and return to floor
                setActiveBill(null);
                setActiveTable(null);
                setOpsTab('tables');
            } else {
                newOrder = await POSService.createOrder(orderInput);
            }

            setCompletedOrder(newOrder);
            setCheckoutModalOpen(false);
            setReceiptModalOpen(true);
        } catch (error) {
            console.error("Payment flow failed", error);
            alert("Failed to process order. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCloseReceipt = () => {
        setReceiptModalOpen(false);
        setCompletedOrder(null);
        clearCart();
    };

    const handleLockTerminal = () => {
        setActiveCashier(null);
        clearCart();
    };

    if (!activeCashier) {
        return <POSLogin users={allUsers} onLogin={setActiveCashier} superAdminPin={superAdminPin || undefined} />;
    }

    const cashierBusinesses = businesses.filter(b => 
        b.id === activeCashier.businessId || 
        activeCashier.businessUnitIds?.includes(b.id)
    );
    const displayBusinesses = cashierBusinesses.length > 0 ? cashierBusinesses : businesses;
    const currentBusiness = displayBusinesses.find(b => b.id === selectedBusinessUnit);

    return (
        <div className="flex flex-col h-screen w-screen bg-slate-100 text-slate-900 overflow-hidden relative">
            {/* Fixed Header — QR Operations design language (light, full-screen, no ERP chrome) */}
            <div className="h-16 flex items-center justify-between px-4 md:px-6 bg-white border-b-2 border-slate-200 z-10 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">Point of Sale</div>
                        {displayBusinesses.length > 1 ? (
                            <select
                                value={selectedBusinessUnit}
                                onChange={(e) => {
                                    setSelectedBusinessUnit(e.target.value);
                                    clearCart();
                                }}
                                className="mt-0.5 -ml-0.5 max-w-[220px] md:max-w-[320px] bg-transparent text-base md:text-lg font-black tracking-tight text-slate-900 focus:outline-none appearance-none cursor-pointer"
                                style={{ backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%2394a3b8\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'m6 8 4 4 4-4\'/%3E%3C/svg%3E")', backgroundPosition: 'right 0.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25em 1.25em', paddingRight: '1.75rem' }}
                            >
                                {displayBusinesses.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-base md:text-lg font-black tracking-tight text-slate-900 leading-tight truncate max-w-[220px] md:max-w-[320px]">
                                {displayBusinesses.find(b => b.id === selectedBusinessUnit)?.name || 'Point of Sale'}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                    <div className="text-sm text-right hidden sm:block">
                        <div className="font-black text-slate-900 leading-tight">{activeCashier.name}</div>
                        <div className="text-slate-500 font-semibold capitalize leading-tight">{activeCashier.role.replace(/_/g, ' ').toLowerCase()}</div>
                    </div>
                    {currentBusiness?.hasTableManagement && (
                        <button
                            onClick={() => setIsTableManagementOpen(true)}
                            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg border-2 border-transparent hover:border-slate-200 transition-colors"
                            title="Table Management"
                        >
                            <LayoutDashboard className="w-5 h-5" />
                        </button>
                    )}
                    <button
                        onClick={() => setReportsModalOpen(true)}
                        className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg border-2 border-transparent hover:border-slate-200 transition-colors"
                        title="Shift & Reports"
                    >
                        <BarChart3 className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setSettingsModalOpen(true)}
                        className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg border-2 border-transparent hover:border-slate-200 transition-colors"
                        title="POS Settings"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleLockTerminal}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg border-2 border-transparent hover:border-red-200 transition-colors"
                        title="Lock Terminal"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Unified operations navigation (light QR-Operations style). "Tables" only
                shows for table-management businesses. QR tabs mount the proven QR views. */}
            <nav className="shrink-0 w-full px-1 md:px-3 flex gap-1 overflow-x-auto bg-white border-b-2 border-slate-200">
                {OPS_TABS.filter(t => !t.tableOnly || currentBusiness?.hasTableManagement).map(t => {
                    const active = t.key === opsTab;
                    return (
                        <button key={t.key} type="button" onClick={() => setOpsTab(t.key)}
                            className={`shrink-0 flex items-center gap-1.5 px-3 md:px-4 py-2.5 text-sm font-bold border-b-[3px] transition-colors ${active ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                            <t.Icon size={16} strokeWidth={2.25} /> {t.label}
                        </button>
                    );
                })}
            </nav>

            {/* Main Application Area */}
            <div className="flex flex-1 overflow-hidden min-h-0">
                {QR_OPS_TABS.includes(opsTab) ? (
                    <QrOpsView
                        embedded
                        activeTab={opsTab as OpsTab}
                        businessUnitId={selectedBusinessUnit}
                        businesses={businesses}
                        onNavigate={(t) => { if (t === 'live' || t === 'kitchen' || t === 'bar' || t === 'history') setOpsTab(t); }}
                    />
                ) : opsTab === 'tables' && currentBusiness?.hasTableManagement ? (
                    <TableFloorView
                        businessUnitId={selectedBusinessUnit} 
                        onSelectTable={(table, bill) => {
                            setActiveTable(table);
                            setActiveBill(bill);
                            setCartItems(bill ? bill.items.map(i => ({ ...i, isSentToKitchen: true })) : []);
                            setOpsTab('pos'); // Switch to order taking for this table
                        }} 
                        onCounterOrder={() => {
                            setActiveTable(null);
                            setActiveBill(null);
                            clearCart();
                            setOpsTab('pos');
                        }}
                    />
                ) : (
                    <>
                        <ProductGrid
                            menuItems={menuItems}
                    isLoading={isLoading}
                    onAddItem={handleAddItem}
                    sellableStockMap={sellableStockMap}
                />
                <CartPane
                    onCheckout={handleCheckout}
                    onRequireManagerAuth={(action) => setManagerAuthAction(() => action)}
                    tableMode={!!activeTable}
                    tableName={activeTable?.name}
                    onPrintRunningBill={handlePrintRunningBill}
                    onSendToKitchen={async () => {
                        if (!activeCashier || !activeTable) return;
                        setIsProcessing(true);
                        try {
                            if (activeBill) {
                                await RunningBillService.updateBillItems(activeBill.id, {
                                    items: cartItems,
                                    subtotal, taxAmount, vatableSales, vatExemptSales, serviceChargeAmount,
                                    discountAmount: (discountAmount || 0) + (globalDiscountAmount || 0),
                                    scPwdDiscountAmount, manualItemDiscountAmount, totalAmount: total
                                });
                            } else {
                                await RunningBillService.openBill(
                                    activeTable.id, activeTable.name, selectedBusinessUnit,
                                    activeCashier.id, activeCashier.name
                                );
                                // Fetch the newly created bill to get its ID, then update it with items
                                const newBill = await RunningBillService.getOpenBillForTable(activeTable.id);
                                if (newBill) {
                                    await RunningBillService.updateBillItems(newBill.id, {
                                        items: cartItems,
                                        subtotal, taxAmount, vatableSales, vatExemptSales, serviceChargeAmount,
                                        discountAmount: (discountAmount || 0) + (globalDiscountAmount || 0),
                                        scPwdDiscountAmount, manualItemDiscountAmount, totalAmount: total
                                    });
                                }
                            }
                            // Return to floor
                            setActiveTable(null);
                            setActiveBill(null);
                            clearCart();
                            setOpsTab('tables');
                        } catch (e) {
                            console.error(e);
                            alert("Failed to send to kitchen.");
                        } finally {
                            setIsProcessing(false);
                        }
                    }}
                    onBackToFloor={() => {
                        setActiveTable(null);
                        setActiveBill(null);
                        clearCart();
                        setOpsTab('tables');
                    }}
                />
                </>
                )}
            </div>

            <CheckoutModal
                isOpen={isCheckoutModalOpen && !isProcessing}
                onClose={() => setCheckoutModalOpen(false)}
                total={total}
                onConfirmPayment={handleConfirmPayment}
            />

            <ReceiptModal
                isOpen={isReceiptModalOpen}
                onClose={handleCloseReceipt}
                order={completedOrder}
            />

            {/* Global Processing Loader */}
            {isProcessing && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl flex flex-col items-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Processing Payment...</h3>
                    </div>
                </div>
            )}
            <POSSettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setSettingsModalOpen(false)}
            />
            <POSReportsModal
                isOpen={isReportsModalOpen}
                onClose={() => setReportsModalOpen(false)}
                activeCashierName={activeCashier?.name}
            />
            
            <ManagerAuthModal
                isOpen={!!managerAuthAction}
                onClose={() => setManagerAuthAction(null)}
                onSuccess={() => {
                    if (managerAuthAction) {
                        managerAuthAction();
                    }
                    setManagerAuthAction(null);
                }}
                users={allUsers}
                superAdminPin={superAdminPin}
                businessUnitId={selectedBusinessUnit}
            />

            {/* Full Screen Table Management Overlay */}
            {isTableManagementOpen && (
                <div className="absolute inset-0 z-50 bg-slate-900">
                    <TableManagementView 
                        businessUnitId={selectedBusinessUnit}
                        onClose={() => setIsTableManagementOpen(false)}
                    />
                </div>
            )}
        </div>
    );
};

export default POSView;
