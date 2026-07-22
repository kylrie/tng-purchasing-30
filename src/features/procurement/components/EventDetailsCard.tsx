/**
 * EventDetailsCard — Conditional BURF section for Event procurement.
 *
 * Renders when purchaseType === 'EVENT'. Captures:
 *   - Client / Event Name
 *   - Event Date & Time
 *   - Venue
 *   - Package Name (optional label)
 *   - Confirmed Guests
 *   - Production Buffer %
 *   - Menu Items — manually composed from FINISHED_GOOD inventory
 *     items with serviceType='Event'
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  CalendarDays, Users, Percent, MapPin, Package, Utensils, Loader2,
  Plus, X, Search, ChevronDown,
} from 'lucide-react';
import type { InventoryItem } from '../../inventory/types/InventoryItem';
import type { BURFEventDetails, EventMenuItem } from '../types';
import {
  getEventFinishedGoods,
  EVENT_VENUES,
} from '../services/eventProcurementService';

interface EventDetailsCardProps {
  businessUnitId: string;
  eventDetails: BURFEventDetails;
  onChange: (details: BURFEventDetails) => void;
  onMarkDirty: () => void;
}

const EventDetailsCard: React.FC<EventDetailsCardProps> = ({
  businessUnitId,
  eventDetails,
  onChange,
  onMarkDirty,
}) => {
  // Available finished goods from inventory
  const [availableFG, setAvailableFG] = useState<(InventoryItem & { id: string })[]>([]);
  const [loadingFG, setLoadingFG] = useState(true);

  // Search / Add UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch available event-type finished goods from inventory
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingFG(true);
      try {
        const items = await getEventFinishedGoods(businessUnitId);
        if (!cancelled) setAvailableFG(items);
      } catch (err) {
        console.error('Failed to load event finished goods:', err);
      } finally {
        if (!cancelled) setLoadingFG(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [businessUnitId]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Computed total servings
  const totalServings = useMemo(() => {
    return Math.ceil(
      eventDetails.confirmedGuests * (1 + eventDetails.productionBufferPercent / 100)
    );
  }, [eventDetails.confirmedGuests, eventDetails.productionBufferPercent]);

  // Filter available FGs by search query, excluding already-added items
  const filteredFG = useMemo(() => {
    const addedIds = new Set(eventDetails.menuItems.map((m) => m.inventoryItemId));
    return availableFG
      .filter((item) => !addedIds.has(item.id))
      .filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [availableFG, eventDetails.menuItems, searchQuery]);

  // Update handler helper
  const update = (patch: Partial<BURFEventDetails>) => {
    const newDetails = { ...eventDetails, ...patch };
    // Recalculate totalServings
    newDetails.totalServings = Math.ceil(
      newDetails.confirmedGuests * (1 + newDetails.productionBufferPercent / 100)
    );
    onChange(newDetails);
    onMarkDirty();
  };

  // Add a finished good to the menu
  const handleAddMenuItem = (item: InventoryItem & { id: string }) => {
    const newItem: EventMenuItem = {
      inventoryItemId: item.id,
      inventoryItemName: item.name,
      qtyPerPax: 1, // Default: 1 serving per guest
    };
    update({ menuItems: [...eventDetails.menuItems, newItem] });
    setSearchQuery('');
    setShowDropdown(false);
  };

  // Remove a finished good from the menu
  const handleRemoveMenuItem = (inventoryItemId: string) => {
    update({
      menuItems: eventDetails.menuItems.filter(
        (m) => m.inventoryItemId !== inventoryItemId
      ),
    });
  };

  // Update qty per pax for a menu item
  const handleUpdateQtyPerPax = (inventoryItemId: string, qty: number) => {
    update({
      menuItems: eventDetails.menuItems.map((m) =>
        m.inventoryItemId === inventoryItemId
          ? { ...m, qtyPerPax: qty }
          : m
      ),
    });
  };

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm dark:shadow-none animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-purple-100 dark:bg-purple-500/20 rounded-lg">
          <CalendarDays size={16} className="text-purple-600 dark:text-purple-400" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Event Details
        </h3>
      </div>

      {/* Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Client / Event Name */}
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-500 uppercase font-medium block mb-1">
            Client / Event
          </label>
          <input
            type="text"
            value={eventDetails.clientEventName}
            onChange={(e) => update({ clientEventName: e.target.value })}
            placeholder="e.g. Acme Corp Annual Dinner"
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
          />
        </div>

        {/* Event Date & Time */}
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-500 uppercase font-medium block mb-1">
            <CalendarDays size={12} className="inline mr-1" />
            Event Date & Time
          </label>
          <input
            type="datetime-local"
            value={eventDetails.eventDatetime}
            onChange={(e) => update({ eventDatetime: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
          />
        </div>

        {/* Venue */}
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-500 uppercase font-medium block mb-1">
            <MapPin size={12} className="inline mr-1" />
            Venue
          </label>
          <select
            value={eventDetails.venue}
            onChange={(e) => update({ venue: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
          >
            <option value="">Select venue...</option>
            {EVENT_VENUES.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Package Name (optional label) */}
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-500 uppercase font-medium block mb-1">
            <Package size={12} className="inline mr-1" />
            Package Name
          </label>
          <input
            type="text"
            value={eventDetails.packageName || ''}
            onChange={(e) => update({ packageName: e.target.value })}
            placeholder="e.g. Premium Package A"
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
          />
        </div>

        {/* Confirmed Guests */}
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-500 uppercase font-medium block mb-1">
            <Users size={12} className="inline mr-1" />
            Confirmed Guests
          </label>
          <input
            type="number"
            min="1"
            value={eventDetails.confirmedGuests || ''}
            onChange={(e) =>
              update({ confirmedGuests: parseInt(e.target.value) || 0 })
            }
            placeholder="50"
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
          />
        </div>

        {/* Production Buffer */}
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-500 uppercase font-medium block mb-1">
            <Percent size={12} className="inline mr-1" />
            Production Buffer (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="5"
            value={eventDetails.productionBufferPercent}
            onChange={(e) =>
              update({ productionBufferPercent: parseFloat(e.target.value) || 0 })
            }
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
          />
        </div>
      </div>

      {/* ================================================================ */}
      {/* Menu Items — Manually composed from Event Finished Goods         */}
      {/* ================================================================ */}
      <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Utensils size={14} className="text-purple-500 dark:text-purple-400" />
            <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Menu Items
            </h4>
            {eventDetails.menuItems.length > 0 && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                ({eventDetails.menuItems.length} items)
              </span>
            )}
          </div>
        </div>

        {/* Add Menu Item — Searchable Dropdown */}
        <div className="relative mb-3" ref={dropdownRef}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder={loadingFG ? 'Loading finished goods...' : 'Search and add finished goods...'}
              disabled={loadingFG}
              className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:border-purple-500 focus:border-solid focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => {
                setShowDropdown(!showDropdown);
                searchInputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-purple-500 transition-colors"
            >
              {loadingFG ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ChevronDown size={14} className={showDropdown ? 'rotate-180 transition-transform' : 'transition-transform'} />
              )}
            </button>
          </div>

          {/* Dropdown Results */}
          {showDropdown && !loadingFG && (
            <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl">
              {filteredFG.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500 text-center">
                  {searchQuery
                    ? 'No matching finished goods found'
                    : availableFG.length === 0
                      ? 'No event finished goods in inventory'
                      : 'All available items already added'}
                </div>
              ) : (
                filteredFG.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddMenuItem(item)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-b-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Plus size={14} className="text-purple-500 shrink-0" />
                      <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 ml-2">
                      {item.department} · {item.category}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Added Menu Items List */}
        {eventDetails.menuItems.length === 0 ? (
          <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm">
            <Utensils size={24} className="mx-auto mb-2 opacity-40" />
            No menu items added yet. Search above to add finished goods.
          </div>
        ) : (
          <div className="space-y-2">
            {eventDetails.menuItems.map((fg) => {
              const totalPortions =
                eventDetails.confirmedGuests > 0
                  ? totalServings * fg.qtyPerPax
                  : 0;
              return (
                <div
                  key={fg.inventoryItemId}
                  className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-700/50 group"
                >
                  {/* Item name */}
                  <span className="text-sm text-slate-700 dark:text-slate-300 truncate flex-1 min-w-0">
                    {fg.inventoryItemName}
                  </span>

                  {/* Qty per pax input */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min="0.1"
                      step="0.5"
                      value={fg.qtyPerPax}
                      onChange={(e) =>
                        handleUpdateQtyPerPax(
                          fg.inventoryItemId,
                          parseFloat(e.target.value) || 1
                        )
                      }
                      className="w-16 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-center text-sm text-slate-700 dark:text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      / guest
                    </span>
                  </div>

                  {/* Total portions */}
                  {totalPortions > 0 && (
                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 shrink-0 min-w-[60px] text-right">
                      {totalPortions} total
                    </span>
                  )}

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveMenuItem(fg.inventoryItemId)}
                    className="p-1 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    title="Remove from menu"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventDetailsCard;
