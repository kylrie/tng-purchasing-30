import React, { useState } from 'react';
import { Pencil, Check, X, Trash2 } from 'lucide-react';
import type { RequisitionItem } from '../types';

interface EditableItemTableProps {
    items: RequisitionItem[];
    onUpdateItems: (items: RequisitionItem[]) => void;
    showSelection?: boolean; // For PRF preparation - show checkboxes
    selectedItemIds?: Set<string>; // Track selected items (for PRF)
    onToggleSelection?: (itemId: string) => void; // Toggle item selection
    onToggleAll?: (selected: boolean) => void; // Toggle all items
    readOnly?: boolean; // Disable all editing
    showDelete?: boolean; // Show delete button
    onDeleteItem?: (index: number) => void; // Delete item callback
    uomOptions?: string[]; // Available UOM options for editing
}

/**
 * Reusable table component for displaying and inline-editing requisition items.
 * Supports:
 * - Inline editing of Quantity and Price
 * - Optional item selection (for PRF splitting)
 * - Optional delete functionality
 * - Read-only mode
 */
const EditableItemTable: React.FC<EditableItemTableProps> = ({
    items,
    onUpdateItems,
    showSelection = false,
    selectedItemIds,
    onToggleSelection,
    onToggleAll,
    readOnly = false,
    showDelete = true,
    onDeleteItem
    // Note: uomOptions prop exists in interface but not used in current implementation
    // Can be added later if UOM editing is needed
}) => {
    // Inline editing state
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editedValues, setEditedValues] = useState<{ quantity: number; price: number }>({ quantity: 0, price: 0 });

    // Calculate total amount
    const calculateTotal = () => {
        if (showSelection && selectedItemIds) {
            return items
                .filter(item => selectedItemIds.has(item.itemId))
                .reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
        }
        return items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
    };

    const allSelected = showSelection && selectedItemIds && items.every(item => selectedItemIds.has(item.itemId));

    // Handlers
    const handleEditClick = (item: RequisitionItem) => {
        if (readOnly) return;
        setEditingItemId(item.itemId);
        setEditedValues({ quantity: item.quantity, price: item.price || 0 });
    };

    const handleCancelEdit = () => {
        setEditingItemId(null);
        setEditedValues({ quantity: 0, price: 0 });
    };

    const handleSaveEdit = (index: number) => {
        // Validation
        if (editedValues.quantity <= 0) {
            alert('Quantity must be greater than 0.');
            return;
        }
        if (editedValues.price < 0) {
            alert('Price cannot be negative.');
            return;
        }

        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            quantity: editedValues.quantity,
            price: editedValues.price
        };
        onUpdateItems(newItems);
        setEditingItemId(null);
        setEditedValues({ quantity: 0, price: 0 });
    };

    const handleDelete = (index: number) => {
        if (onDeleteItem) {
            onDeleteItem(index);
        } else {
            const newItems = items.filter((_, i) => i !== index);
            onUpdateItems(newItems);
        }
    };

    return (
        <div className="border border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-slate-900/80 border-b border-slate-700 sticky top-0 z-20 backdrop-blur-sm">
                    <tr>
                        {showSelection && (
                            <th className="px-4 py-3 text-left font-semibold text-slate-400 w-8">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={(e) => onToggleAll?.(e.target.checked)}
                                    className="rounded cursor-pointer bg-slate-800 border-slate-600"
                                    disabled={readOnly}
                                />
                            </th>
                        )}
                        <th className="px-4 py-3 text-left font-semibold text-slate-400">ITEM</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-400">QTY / UOM</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-400">REMARKS</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-400">UNIT PRICE</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-400">TOTAL</th>
                        {!readOnly && (
                            <th className="px-4 py-3 text-right font-semibold text-slate-400 w-24">ACTIONS</th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {items.map((item, index) => {
                        const isEditing = editingItemId === item.itemId;
                        const isSelected = !showSelection || selectedItemIds?.has(item.itemId);
                        const displayQty = isEditing ? editedValues.quantity : item.quantity;
                        const displayPrice = isEditing ? editedValues.price : (item.price || 0);
                        const rowOpacity = showSelection && !isSelected ? 'opacity-50 bg-slate-900/30' : '';

                        return (
                            <tr key={item.itemId || index} className={`hover:bg-slate-700/30 ${rowOpacity}`}>
                                {showSelection && (
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => onToggleSelection?.(item.itemId)}
                                            className="rounded cursor-pointer bg-slate-800 border-slate-600"
                                            disabled={isEditing || readOnly}
                                        />
                                    </td>
                                )}
                                <td className="px-4 py-3 font-medium text-slate-200">{item.name}</td>
                                {/* Quantity - editable when in edit mode */}
                                <td className="px-4 py-3">
                                    {isEditing ? (
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                value={displayQty}
                                                onChange={(e) => setEditedValues({
                                                    ...editedValues,
                                                    quantity: parseFloat(e.target.value) || 0
                                                })}
                                                min="1"
                                                className="w-20 px-2 py-1 bg-blue-900/30 border border-blue-500 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                            />
                                            <span className="text-slate-400 text-sm">{item.uom}</span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-400">{item.quantity} {item.uom}</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-slate-500 text-xs">{item.remarks || '-'}</td>
                                {/* Price - editable when in edit mode */}
                                <td className="px-4 py-3">
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            value={displayPrice}
                                            onChange={(e) => setEditedValues({
                                                ...editedValues,
                                                price: parseFloat(e.target.value) || 0
                                            })}
                                            min="0"
                                            step="0.01"
                                            className="w-24 px-2 py-1 bg-blue-900/30 border border-blue-500 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                        />
                                    ) : (
                                        <span className="text-slate-300">₱{(item.price || 0).toLocaleString()}</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-200">
                                    ₱{(displayPrice * displayQty).toLocaleString()}
                                </td>
                                {/* Actions column */}
                                {!readOnly && (
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-1">
                                            {isEditing ? (
                                                <>
                                                    <button
                                                        onClick={() => handleSaveEdit(index)}
                                                        className="p-1 text-green-400 hover:text-green-300 hover:bg-green-900/30 rounded"
                                                        title="Save"
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                    <button
                                                        onClick={handleCancelEdit}
                                                        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded"
                                                        title="Cancel"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleEditClick(item)}
                                                        disabled={showSelection && !isSelected}
                                                        className="p-1 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title="Edit Quantity & Price"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    {showDelete && (
                                                        <button
                                                            onClick={() => handleDelete(index)}
                                                            className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded"
                                                            title="Delete Item"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot className="bg-slate-900/50 border-t-2 border-slate-700">
                    <tr>
                        <td colSpan={showSelection ? 5 : 4} className="px-4 py-3 text-right font-bold text-slate-300">
                            Total Amount {showSelection ? '(Selected)' : ''}
                        </td>
                        <td colSpan={readOnly ? 1 : 2} className="px-4 py-3 text-right font-bold text-blue-400 text-lg">
                            ₱{calculateTotal().toLocaleString()}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

export default EditableItemTable;
