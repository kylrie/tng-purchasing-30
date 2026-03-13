import { useState, useEffect } from 'react';
import { RecipesService } from '../../menu/services/recipes.service';
import type { MenuItem } from '../../menu/types/menu.types';

export function usePOSMenu(businessUnitId: string) {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchMenu = async () => {
            if (!businessUnitId) {
                setMenuItems([]);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const items = await RecipesService.getMenuItems(businessUnitId);
                // In POS, we typically only want active items that can be sold
                const activeItems = items.filter(item => item.isActive !== false);
                setMenuItems(activeItems);
            } catch (err) {
                console.error("Failed to load POS menu items:", err);
                setError('Failed to load menu items');
            } finally {
                setIsLoading(false);
            }
        };

        fetchMenu();
    }, [businessUnitId]);

    return { menuItems, isLoading, error };
}
