import { useState, useMemo, useCallback, useEffect } from 'react';
import type { MenuItem } from '../../menu/types/menu.types';
import type { POSOrderItem } from '../types/pos.types';
import { SettingsService, type POSSettings } from '../../../shared/services/settings.service';

export function useCart() {
    const [cartItems, setCartItems] = useState<POSOrderItem[]>([]);
    const [posSettings, setPosSettings] = useState<POSSettings>({ vatRate: 12, serviceChargeRate: 0 });
    const [globalDiscountRate, setGlobalDiscountRate] = useState<number>(0);

    useEffect(() => {
        SettingsService.getPOSSettings().then(settings => {
            setPosSettings(settings);
        });
    }, []);

    const addToCart = useCallback((menuItem: MenuItem, quantity: number = 1, notes: string = '') => {
        setCartItems(prev => {
            const existingItemIndex = prev.findIndex(item => item.menuItemId === menuItem.id && item.notes === notes);

            if (existingItemIndex >= 0) {
                // Update existing item
                const newItems = [...prev];
                const updatedQty = newItems[existingItemIndex].quantity + quantity;
                newItems[existingItemIndex] = {
                    ...newItems[existingItemIndex],
                    quantity: updatedQty,
                    subtotal: updatedQty * newItems[existingItemIndex].unitPrice
                };
                return newItems;
            }

            // Add new item
            const newItem: POSOrderItem = {
                menuItemId: menuItem.id,
                productName: menuItem.name,
                quantity: quantity,
                unitPrice: menuItem.sellingPrice,
                subtotal: quantity * menuItem.sellingPrice,
                category: menuItem.category,
                notes,
                isDiscounted: false,
                vatAmount: 0,
                discountAmount: 0,
                vatExemptAmount: 0,
                menuItemData: menuItem
            };
            return [...prev, newItem];
        });
    }, []);

    const toggleDiscount = useCallback((index: number) => {
        setCartItems(prev => {
            const newItems = [...prev];
            newItems[index] = {
                ...newItems[index],
                isDiscounted: !newItems[index].isDiscounted
            };
            return newItems;
        });
    }, []);

    const updateQuantity = useCallback((index: number, quantity: number) => {
        setCartItems(prev => {
            const newItems = [...prev];
            if (quantity <= 0) {
                return newItems.filter((_, i) => i !== index);
            }
            newItems[index] = {
                ...newItems[index],
                quantity,
                subtotal: quantity * newItems[index].unitPrice
            };
            return newItems;
        });
    }, []);

    const removeFromCart = useCallback((index: number) => {
        setCartItems(prev => prev.filter((_, i) => i !== index));
    }, []);

    const clearCart = useCallback(() => {
        setCartItems([]);
        setGlobalDiscountRate(0);
    }, []);

    // Perform Calculations based on Philippine Law
    const calculations = useMemo(() => {
        const vatRate = (posSettings.vatRate || 12) / 100;
        const scRate = (posSettings.serviceChargeRate || 0) / 100;

        let grossSubtotal = 0;
        let totalVatAmount = 0;
        let totalDiscount = 0;
        let finalSubtotal = 0; // After discounts, before SC

        // We map and update the cartItems with calculated fields for display/saving
        const computedItems = cartItems.map(item => {
            const rawSubtotal = item.unitPrice * item.quantity;
            grossSubtotal += rawSubtotal;

            let itemVat = 0;
            let itemDiscount = 0;
            let itemVatExempt = 0;
            let itemFinalSubtotal = rawSubtotal;

            if (item.isDiscounted) {
                // Remove VAT
                itemVatExempt = rawSubtotal / (1 + vatRate);
                // Apply 20% discount on the VAT-exempt amount
                itemDiscount = itemVatExempt * 0.20;
                itemFinalSubtotal = itemVatExempt - itemDiscount;
            } else {
                // Regular item: VAT is embedded in the price
                // e.g. 112 -> 12 is VAT
                itemVat = rawSubtotal - (rawSubtotal / (1 + vatRate));
                itemFinalSubtotal = rawSubtotal;
            }

            totalVatAmount += itemVat;
            totalDiscount += itemDiscount;
            finalSubtotal += itemFinalSubtotal;

            return {
                ...item,
                subtotal: itemFinalSubtotal,
                vatAmount: itemVat,
                discountAmount: itemDiscount,
                vatExemptAmount: itemVatExempt
            };
        });

        // Apply global custom discount if any
        let globalDiscountAmount = 0;
        if (globalDiscountRate > 0) {
            // Apply custom discount to the final subtotal (before SC)
            globalDiscountAmount = finalSubtotal * (globalDiscountRate / 100);
            finalSubtotal -= globalDiscountAmount;
            totalDiscount += globalDiscountAmount;
        }

        const serviceChargeAmount = finalSubtotal * scRate;
        const total = finalSubtotal + serviceChargeAmount;

        return {
            computedItems,
            grossSubtotal,
            totalDiscount,
            globalDiscountAmount,
            totalVatAmount,
            finalSubtotal,
            serviceChargeAmount,
            total
        };
    }, [cartItems, posSettings, globalDiscountRate]);

    return {
        cartItems: calculations.computedItems,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        toggleDiscount,
        globalDiscountRate,
        setGlobalDiscountRate,
        subtotal: calculations.finalSubtotal,
        grossSubtotal: calculations.grossSubtotal,
        taxAmount: calculations.totalVatAmount,
        serviceChargeAmount: calculations.serviceChargeAmount,
        discountAmount: calculations.totalDiscount,
        globalDiscountAmount: calculations.globalDiscountAmount,
        total: calculations.total
    };
}
