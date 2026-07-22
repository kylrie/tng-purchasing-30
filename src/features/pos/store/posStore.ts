import { create } from 'zustand';
import type { POSOrderItem } from '../types/pos.types';
import type { POSSettings } from '../../../shared/services/settings.service';
import type { MenuItem } from '../../menu/types/menu.types';
import { calculateCartTotals } from '../utils/pricingEngine';

interface POSState {
    // Data
    cartItems: POSOrderItem[];
    posSettings: POSSettings;
    globalDiscountRate: number;
    
    // Calculated Totals
    grossSubtotal: number;
    totalDiscount: number;
    totalScPwdDiscount: number;
    totalManualDiscount: number;
    globalDiscountAmount: number;
    totalVatableSales: number;
    totalVatExemptSales: number;
    totalVatAmount: number;
    finalSubtotal: number;
    serviceChargeAmount: number;
    total: number;

    // Actions
    setSettings: (settings: POSSettings) => void;
    addToCart: (menuItem: MenuItem, quantity?: number, notes?: string) => void;
    updateQuantity: (index: number, quantity: number) => void;
    removeFromCart: (index: number) => void;
    clearCart: () => void;
    toggleDiscount: (index: number) => void;
    setItemDiscountRate: (index: number, rate: number, reason?: string, type?: 'percentage' | 'amount') => void;
    setGlobalDiscountRate: (rate: number) => void;
    setCartItems: (items: POSOrderItem[]) => void;
}

export const usePOSStore = create<POSState>((set, get) => ({
    cartItems: [],
    posSettings: { vatRate: 12, serviceChargeRate: 0 },
    globalDiscountRate: 0,
    
    grossSubtotal: 0,
    totalDiscount: 0,
    totalScPwdDiscount: 0,
    totalManualDiscount: 0,
    globalDiscountAmount: 0,
    totalVatableSales: 0,
    totalVatExemptSales: 0,
    totalVatAmount: 0,
    finalSubtotal: 0,
    serviceChargeAmount: 0,
    total: 0,

    setSettings: (settings) => {
        set({ posSettings: settings });
        const state = get();
        const totals = calculateCartTotals(state.cartItems, settings, state.globalDiscountRate);
        set({ cartItems: totals.computedItems, ...totals });
    },

    addToCart: (menuItem, quantity = 1, notes = '') => {
        const state = get();
        const prevItems = [...state.cartItems];
        const existingItemIndex = prevItems.findIndex(item => item.menuItemId === menuItem.id && item.notes === notes);

        let newItems;
        if (existingItemIndex >= 0) {
            newItems = [...prevItems];
            const updatedQty = newItems[existingItemIndex].quantity + quantity;
            newItems[existingItemIndex] = {
                ...newItems[existingItemIndex],
                quantity: updatedQty,
                subtotal: updatedQty * newItems[existingItemIndex].unitPrice
            };
        } else {
            const newItem: POSOrderItem = {
                menuItemId: menuItem.id,
                productName: menuItem.name,
                quantity: quantity,
                unitPrice: menuItem.sellingPrice,
                subtotal: quantity * menuItem.sellingPrice,
                category: menuItem.category,
                notes,
                isDiscounted: false,
                discountType: 'percentage',
                discountRate: 0,
                discountReason: '',
                vatAmount: 0,
                discountAmount: 0,
                vatExemptAmount: 0,
                menuItemData: menuItem
            };
            newItems = [...prevItems, newItem];
        }

        const totals = calculateCartTotals(newItems, state.posSettings, state.globalDiscountRate);
        set({ cartItems: totals.computedItems, ...totals });
    },

    updateQuantity: (index, quantity) => {
        const state = get();
        let newItems = [...state.cartItems];
        if (quantity <= 0) {
            newItems = newItems.filter((_, i) => i !== index);
        } else {
            newItems[index] = {
                ...newItems[index],
                quantity,
                subtotal: quantity * newItems[index].unitPrice
            };
        }
        const totals = calculateCartTotals(newItems, state.posSettings, state.globalDiscountRate);
        set({ cartItems: totals.computedItems, ...totals });
    },

    removeFromCart: (index) => {
        const state = get();
        const newItems = state.cartItems.filter((_, i) => i !== index);
        const totals = calculateCartTotals(newItems, state.posSettings, state.globalDiscountRate);
        set({ cartItems: totals.computedItems, ...totals });
    },

    clearCart: () => {
        const state = get();
        const totals = calculateCartTotals([], state.posSettings, 0);
        set({ cartItems: totals.computedItems, ...totals, globalDiscountRate: 0 });
    },

    toggleDiscount: (index) => {
        const state = get();
        const newItems = [...state.cartItems];
        newItems[index] = {
            ...newItems[index],
            isDiscounted: !newItems[index].isDiscounted
        };
        const totals = calculateCartTotals(newItems, state.posSettings, state.globalDiscountRate);
        set({ cartItems: totals.computedItems, ...totals });
    },

    setItemDiscountRate: (index, rate, reason, type) => {
        const state = get();
        const newItems = [...state.cartItems];
        newItems[index] = {
            ...newItems[index],
            discountRate: rate,
            discountReason: reason !== undefined ? reason : newItems[index].discountReason,
            discountType: type !== undefined ? type : (newItems[index].discountType || 'percentage')
        };
        const totals = calculateCartTotals(newItems, state.posSettings, state.globalDiscountRate);
        set({ cartItems: totals.computedItems, ...totals });
    },

    setGlobalDiscountRate: (rate) => {
        const state = get();
        const totals = calculateCartTotals(state.cartItems, state.posSettings, rate);
        set({ globalDiscountRate: rate, cartItems: totals.computedItems, ...totals });
    },

    setCartItems: (items) => {
        const state = get();
        const totals = calculateCartTotals(items, state.posSettings, state.globalDiscountRate);
        set({ cartItems: totals.computedItems, ...totals });
    }
}));
