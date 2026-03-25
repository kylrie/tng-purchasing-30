import { useState, useEffect, useMemo } from 'react';
import { RecipesService } from '../../menu/services/recipes.service';
import { InventoryService } from '../../inventory/services/inventory.service';
import { calculateSellableQuantity } from '../../inventory/utils/sellable-quantity';
import type { MenuItem } from '../../menu/types/menu.types';
import type { InventoryItem } from '../../inventory/types/InventoryItem';

export function usePOSMenu(businessUnitId: string) {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchMenu = async () => {
            if (!businessUnitId) {
                setMenuItems([]);
                setInventoryItems([]);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const [items, allInvItems] = await Promise.all([
                    RecipesService.getMenuItems(businessUnitId),
                    InventoryService.getInventory(businessUnitId) // ALL items, no type filter
                ]);
                // In POS, we typically only want active items that can be sold
                const activeItems = items.filter(item => item.isActive !== false);
                setMenuItems(activeItems);
                setInventoryItems(allInvItems);
            } catch (err) {
                console.error("Failed to load POS menu items:", err);
                setError('Failed to load menu items');
            } finally {
                setIsLoading(false);
            }
        };

        fetchMenu();
    }, [businessUnitId]);

    // Build inventory map and compute sellable stock per menu item
    const sellableStockMap = useMemo(() => {
        const invMap = new Map<string, InventoryItem>();
        inventoryItems.forEach(item => invMap.set(item.id, item));

        const stockMap = new Map<string, number>();
        for (const menuItem of menuItems) {
            if (menuItem.linkedInventoryItemId) {
                const fgItem = invMap.get(menuItem.linkedInventoryItemId);
                if (fgItem) {
                    stockMap.set(menuItem.id, calculateSellableQuantity(fgItem, invMap));
                }
            }
            // If no linked inventory item, don't restrict (unlimited)
        }
        return stockMap;
    }, [menuItems, inventoryItems]);

    return { menuItems, isLoading, error, sellableStockMap };
}

