import { useState, useMemo } from 'react';
import type { MenuItem } from '../../menu/types/menu.types';
import type { POSOrderItem } from '../types/pos.types';

export function useCart() {
    const [cartItems, setCartItems] = useState<POSOrderItem[]>([]);

    const addToCart = (menuItem: MenuItem, quantity: number = 1, notes: string = '') => {
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
                menuItemData: menuItem
            };
            return [...prev, newItem];
        });
    };

    const updateQuantity = (index: number, quantity: number) => {
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
    };

    const removeFromCart = (index: number) => {
        setCartItems(prev => prev.filter((_, i) => i !== index));
    };

    const clearCart = () => {
        setCartItems([]);
    };

    const subtotal = useMemo(() => {
        return cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    }, [cartItems]);

    // Compute Tax (e.g. 12% VAT logic could be here, or structured per item)
    // For now assuming inclusive or simple setup
    const taxRate = 0; // Configurable if needed
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    return {
        cartItems,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        subtotal,
        taxAmount,
        total
    };
}
