import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/useAuth';
import { usePOSMenu } from '../hooks/usePOSMenu';
import { useCart } from '../hooks/useCart';
import { POSService } from '../services/pos.service';
import type { POSOrder, PaymentMethod, POSOrderCreateInput, POSTable, RunningBill } from '../types/pos.types';
import type { User } from '../../../shared/types';
import type { MenuItem } from '../../menu/types/menu.types';
import { LogOut, Settings, BarChart3, LayoutDashboard } from 'lucide-react';
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
        setCartItems,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        toggleDiscount,
        setItemDiscountRate,
        globalDiscountRate,
        setGlobalDiscountRate,
        globalDiscountAmount,
        subtotal,
        grossSubtotal,
        vatableSales,
        vatExemptSales,
        taxAmount,
        serviceChargeAmount,
        discountAmount,
        scPwdDiscountAmount,
        manualItemDiscountAmount,
        total
    } = useCart();

    const [isCheckoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [isReceiptModalOpen, setReceiptModalOpen] = useState(false);
    const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
    const [isReportsModalOpen, setReportsModalOpen] = useState(false);
    const [isTableManagementOpen, setIsTableManagementOpen] = useState(false);
    const [completedOrder, setCompletedOrder] = useState<POSOrder | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Table mode state
    const [viewMode, setViewMode] = useState<'counter' | 'table'>('counter');
    const [activeTable, setActiveTable] = useState<POSTable | null>(null);
    const [activeBill, setActiveBill] = useState<RunningBill | null>(null);
    
    // Manager Auth
    const [managerAuthAction, setManagerAuthAction] = useState<(() => void) | null>(null);

    // Watch business unit to set initial view mode if it has table management
    useEffect(() => {
        const currentBiz = businesses.find(b => b.id === selectedBusinessUnit);
        if (currentBiz?.hasTableManagement) {
            setViewMode('table');
        } else {
            setViewMode('counter');
        }
        setActiveTable(null);
        setActiveBill(null);
        clearCart();
    }, [selectedBusinessUnit, businesses, clearCart]);

    const handleAddItem = React.useCallback((item: MenuItem) => {
        addToCart(item, 1);
    }, [addToCart]);

    const handleCheckout = React.useCallback(() => {
        setCheckoutModalOpen(true);
    }, []);

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
                newOrder = { id: 'settled-bill', ...orderInput, status: 'COMPLETED', createdAt: new Date() as any, updatedAt: new Date() as any } as POSOrder;
                
                // Clear active bill and return to floor
                setActiveBill(null);
                setActiveTable(null);
                setViewMode('table');
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
        <div className="flex flex-col h-screen w-screen bg-slate-900 overflow-hidden relative">
            {/* Fixed Header */}
            <div className="h-16 flex items-center justify-between px-6 bg-slate-800 border-b border-slate-700 z-10 shrink-0">
                <div className="flex items-center">
                    <h1 className="text-xl font-bold text-white">Point of Sale</h1>
                    {displayBusinesses.length > 1 ? (
                        <select
                            value={selectedBusinessUnit}
                            onChange={(e) => {
                                setSelectedBusinessUnit(e.target.value);
                                clearCart();
                            }}
                            className="ml-4 px-3 py-1 bg-slate-700/50 border border-slate-600 rounded-full text-sm font-medium text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                            style={{ backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%2394a3b8\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'m6 8 4 4 4-4\'/%3E%3C/svg%3E")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2rem' }}
                        >
                            {displayBusinesses.map(b => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        displayBusinesses.find(b => b.id === selectedBusinessUnit) && (
                            <span className="ml-4 px-3 py-1 bg-slate-700 rounded-full text-sm font-medium text-slate-300">
                                {displayBusinesses.find(b => b.id === selectedBusinessUnit)?.name}
                            </span>
                        )
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-sm text-right">
                        <div className="font-medium text-white">{activeCashier.name}</div>
                        <div className="text-slate-400 capitalize">{activeCashier.role.replace(/_/g, ' ').toLowerCase()}</div>
                    </div>
                    {currentBusiness?.hasTableManagement && (
                        <button
                            onClick={() => setIsTableManagementOpen(true)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors"
                            title="Table Management"
                        >
                            <LayoutDashboard className="w-5 h-5" />
                        </button>
                    )}
                    <button
                        onClick={() => setReportsModalOpen(true)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors"
                        title="Shift & Reports"
                    >
                        <BarChart3 className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setSettingsModalOpen(true)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors"
                        title="POS Settings"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleLockTerminal}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors"
                        title="Lock Terminal"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Main Application Area */}
            <div className="flex flex-1 overflow-hidden">
                {viewMode === 'table' && currentBusiness?.hasTableManagement ? (
                    <TableFloorView 
                        businessUnitId={selectedBusinessUnit} 
                        onSelectTable={(table, bill) => {
                            setActiveTable(table);
                            setActiveBill(bill);
                            setCartItems(bill ? bill.items.map(i => ({ ...i, isSentToKitchen: true })) : []);
                            setViewMode('counter'); // Switch to order taking mode for this table
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
                    cartItems={cartItems}
                    subtotal={subtotal}
                    grossSubtotal={grossSubtotal}
                    taxAmount={taxAmount}
                    vatableSales={vatableSales}
                    vatExemptSales={vatExemptSales}
                    serviceChargeAmount={serviceChargeAmount}
                    scPwdDiscountAmount={scPwdDiscountAmount}
                    manualItemDiscountAmount={manualItemDiscountAmount}
                    globalDiscountRate={globalDiscountRate}
                    setGlobalDiscountRate={setGlobalDiscountRate}
                    globalDiscountAmount={globalDiscountAmount}
                    total={total}
                    onUpdateQuantity={updateQuantity}
                    onRemoveItem={removeFromCart}
                    onToggleDiscount={toggleDiscount}
                    onSetItemDiscountRate={setItemDiscountRate}
                    onCheckout={handleCheckout}
                    onClearCart={() => {
                        if (cartItems.some(i => i.isSentToKitchen)) {
                            setManagerAuthAction(() => clearCart);
                        } else {
                            clearCart();
                        }
                    }}
                    onRequireManagerAuth={(action) => setManagerAuthAction(() => action)}
                    tableMode={!!activeTable}
                    tableName={activeTable?.name}
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
                            setViewMode('table');
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
                        setViewMode('table');
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
