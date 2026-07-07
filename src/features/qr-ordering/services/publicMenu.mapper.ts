// QR Ordering — pure mapping between the getPublicMenu callable's response and
// the UI's PublicMenuItem shape. No Firebase imports on purpose: everything here
// is deterministic and unit-testable in isolation.
//
// Security (Master Plan §6.4 / task rule 8): this mapper is FIELD-WHITELISTED —
// it copies only known public fields, so cost/margin/recipe/ingredients/
// linkedInventoryItemId can never reach the UI even if the server DTO ever
// carried them. The server already strips them; this is defence in depth.

import { MENU_GROUPS } from '../data/mockMenu';
import type { MenuGroup, PublicMenuItem } from '../data/mockMenu';

/**
 * Sanitized menu item exactly as returned by the getPublicMenu callable
 * (mirrors functions/src/qr/orderLogic.ts → PublicMenuItemDTO). Note it carries
 * only the level-2 `category`; the UI's Food/Drinks `group` is derived below.
 */
export interface PublicMenuItemDTO {
    id: string;
    name: string;
    category: string;
    sellingPrice: number;
    description?: string;
    imageUrl?: string;
    isAvailable: boolean;
}

/** Full getPublicMenu callable response. */
export interface GetPublicMenuResponse {
    tableId: string;
    tableNumber: string;
    businessUnitId: string;
    items: PublicMenuItemDTO[];
}

/** UI-facing result after mapping (drops businessUnitId — not needed by the view). */
export interface PublicMenuResult {
    tableId: string;
    tableNumber: string;
    items: PublicMenuItem[];
}

/** Items whose category doesn't match any known subcategory land here so they
 *  still carry a valid group; the fixed two-level nav only surfaces items whose
 *  category matches one of its subcategory tabs. */
const DEFAULT_GROUP: MenuGroup = 'Food';

/** Build a category → group lookup from the approved two-level hierarchy. */
export function buildCategoryGroupIndex(
    groups: { key: MenuGroup; subcategories: string[] }[] = MENU_GROUPS,
): Map<string, MenuGroup> {
    const index = new Map<string, MenuGroup>();
    for (const group of groups) {
        for (const sub of group.subcategories) {
            if (!index.has(sub)) index.set(sub, group.key);
        }
    }
    return index;
}

/**
 * Map one sanitized server DTO to a UI PublicMenuItem. Field-whitelisted:
 * only id/name/category/sellingPrice/isAvailable (+ optional description/imageUrl)
 * are ever read. `group` is derived from `category`. `bestSeller` is intentionally
 * absent for real data (the server DTO does not provide it).
 */
export function mapMenuItem(
    dto: PublicMenuItemDTO,
    index: Map<string, MenuGroup> = buildCategoryGroupIndex(),
): PublicMenuItem {
    const item: PublicMenuItem = {
        id: dto.id,
        name: dto.name,
        group: index.get(dto.category) ?? DEFAULT_GROUP,
        category: dto.category,
        sellingPrice: dto.sellingPrice,
        isAvailable: dto.isAvailable === true,
    };
    if (typeof dto.description === 'string') item.description = dto.description;
    if (typeof dto.imageUrl === 'string') item.imageUrl = dto.imageUrl;
    return item;
}

/** Map a full callable response into the UI result shape. */
export function mapPublicMenuResponse(res: GetPublicMenuResponse): PublicMenuResult {
    const index = buildCategoryGroupIndex();
    return {
        tableId: res.tableId,
        tableNumber: res.tableNumber,
        items: Array.isArray(res.items) ? res.items.map(dto => mapMenuItem(dto, index)) : [],
    };
}

/**
 * Decide whether to serve the local mock menu instead of calling the backend.
 * Mock when: Firebase isn't really configured (local dev), no table id in the
 * route, or the explicit demo route (/order/demo). Otherwise the real callable
 * is used with the route param as the opaque QR token.
 */
export function shouldUseMockMenu(tableId: string | undefined, configValid: boolean): boolean {
    if (!configValid) return true;
    if (!tableId || tableId.trim() === '') return true;
    return tableId.trim().toLowerCase() === 'demo';
}
