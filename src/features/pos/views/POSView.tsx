import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/useAuth';
import { usePOSMenu } from '../hooks/usePOSMenu';
import { useCart } from '../hooks/useCart';
import { POSService } from '../services/pos.service';
import type { POSOrder, PaymentMethod, POSOrderCreateInput } from '../types/pos.types';
import type { User } from '../../../shared/types';
import type { MenuItem } from '../../menu/types/menu.types';
import { LogOut } from 'lucide-react';
import { SettingsService } from '../../../shared/services/settings.service';

import ProductGrid from '../components/ProductGrid';
import CartPane from '../components/CartPane';
import CheckoutModal from '../components/CheckoutModal';
import ReceiptModal from '../components/ReceiptModal';
import POSLogin from '../components/POSLogin';

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

    const { menuItems, isLoading, sellableStockMap } = usePOSMenu(selectedBusinessUnit);
    const { 
        cartItems,
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
    const [completedOrder, setCompletedOrder] = useState<POSOrder | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

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
                paymentMethod
            };

            const newOrder = await POSService.createOrder(orderInput);

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

    return (
        <div className="flex flex-col h-screen w-screen bg-slate-900 overflow-hidden">
            {/* Fixed Header */}
            <div className="h-16 flex items-center justify-between px-6 bg-slate-800 border-b border-slate-700 z-10 shrink-0">
                <div className="flex items-center">
                    <h1 className="text-xl font-bold text-white">Point of Sale</h1>
                    {businesses.length > 1 ? (
                        <select
                            value={selectedBusinessUnit}
                            onChange={(e) => {
                                setSelectedBusinessUnit(e.target.value);
                                clearCart();
                            }}
                            className="ml-4 px-3 py-1 bg-slate-700/50 border border-slate-600 rounded-full text-sm font-medium text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                            style={{ backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%2394a3b8\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'m6 8 4 4 4-4\'/%3E%3C/svg%3E")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2rem' }}
                        >
                            {businesses.map(b => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        businesses.find(b => b.id === selectedBusinessUnit) && (
                            <span className="ml-4 px-3 py-1 bg-slate-700 rounded-full text-sm font-medium text-slate-300">
                                {businesses.find(b => b.id === selectedBusinessUnit)?.name}
                            </span>
                        )
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-sm">
                        <div className="font-medium text-white">{activeCashier.name}</div>
                        <div className="text-slate-400 capitalize">{activeCashier.role.replace(/_/g, ' ').toLowerCase()}</div>
                    </div>
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
                    onClearCart={clearCart}
                />
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
        </div>
    );
};

export default POSView;
