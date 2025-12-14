import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, Check, Loader2 } from 'lucide-react';
import { CoaService } from '../services/coa.service';
import type { ChartOfAccount } from '../types/firebase.types';

export interface SelectedAccount {
    code: string;
    name: string;
}

interface AccountSelectorProps {
    value?: SelectedAccount | null;
    onChange: (account: SelectedAccount | null) => void;
    className?: string;
    placeholder?: string;
    disabled?: boolean;
}

/**
 * AccountSelector Component - Portal-based for table overflow safety
 * Searchable dropdown that displays COA accounts as "[Code] - [Name]"
 * Uses React Portal to render menu at document.body level
 */
const AccountSelector: React.FC<AccountSelectorProps> = ({
    value,
    onChange,
    className = '',
    placeholder = 'Select COA...',
    disabled = false,
}) => {
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0, openAbove: false });

    const buttonRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Load accounts on mount
    useEffect(() => {
        const loadAccounts = async () => {
            try {
                setError(null);
                const data = await CoaService.getActiveAccounts();
                setAccounts(data);
            } catch (err) {
                console.error('[AccountSelector] Failed to load accounts:', err);
                setError('Failed to load accounts');
            } finally {
                setLoading(false);
            }
        };
        loadAccounts();
    }, []);

    // Filter accounts based on search
    const filteredAccounts = useMemo(() => {
        if (!searchQuery.trim()) return accounts;
        const query = searchQuery.toLowerCase();
        return accounts.filter(acc =>
            acc.code.toLowerCase().includes(query) ||
            acc.name.toLowerCase().includes(query) ||
            acc.accountType?.toLowerCase().includes(query)
        );
    }, [accounts, searchQuery]);

    // Calculate menu position
    const updatePosition = useCallback(() => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const scrollY = window.scrollY;
            const scrollX = window.scrollX;

            // Calculate menu height (approx 36px per item + 50px for search)
            const menuHeight = Math.min(filteredAccounts.length * 36 + 50, 320);
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const openAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;

            setMenuPosition({
                top: openAbove
                    ? scrollY + rect.top - menuHeight - 4
                    : scrollY + rect.bottom + 4,
                left: scrollX + rect.left,
                width: Math.max(rect.width, 320), // Minimum width for readability
                openAbove,
            });
        }
    }, [filteredAccounts.length]);

    // Update position on open and on scroll/resize
    useEffect(() => {
        if (isOpen) {
            updatePosition();

            const handleScrollOrResize = () => updatePosition();
            window.addEventListener('scroll', handleScrollOrResize, true);
            window.addEventListener('resize', handleScrollOrResize);

            // Focus search input
            setTimeout(() => searchInputRef.current?.focus(), 10);

            return () => {
                window.removeEventListener('scroll', handleScrollOrResize, true);
                window.removeEventListener('resize', handleScrollOrResize);
            };
        }
    }, [isOpen, updatePosition]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isOpen &&
                buttonRef.current &&
                menuRef.current &&
                !buttonRef.current.contains(event.target as Node) &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Handle account selection
    const handleSelect = (account: ChartOfAccount) => {
        onChange({ code: account.code, name: account.name });
        setIsOpen(false);
        setSearchQuery('');
    };

    // Clear selection
    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
    };

    // Toggle dropdown
    const toggleDropdown = () => {
        if (!disabled && !loading) {
            setIsOpen(!isOpen);
            if (isOpen) {
                setSearchQuery('');
            }
        }
    };

    // Format display value
    const displayValue = value ? `${value.code} - ${value.name}` : '';

    // Render the floating menu via portal
    const renderMenu = () => {
        if (!isOpen) return null;

        const menu = (
            <div
                ref={menuRef}
                className="fixed bg-slate-800 border border-slate-600 rounded-lg shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100"
                style={{
                    top: menuPosition.top,
                    left: menuPosition.left,
                    width: menuPosition.width,
                    zIndex: 9999,
                }}
            >
                {/* Search Input */}
                <div className="p-2 border-b border-slate-700 bg-slate-800/95 backdrop-blur sticky top-0">
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by code or name..."
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-900/50 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>

                {/* Options List */}
                <div className="max-h-64 overflow-y-auto">
                    {error ? (
                        <div className="px-3 py-4 text-sm text-red-400 text-center">{error}</div>
                    ) : filteredAccounts.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-slate-500 text-center">
                            {searchQuery ? 'No accounts match your search' : `No accounts available (${accounts.length} total)`}
                        </div>
                    ) : (
                        filteredAccounts.map((account) => (
                            <div
                                key={account.code}
                                onClick={() => handleSelect(account)}
                                className={`
                                    px-3 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between gap-2
                                    ${value?.code === account.code
                                        ? 'bg-purple-600/20 text-purple-300'
                                        : 'text-slate-300 hover:bg-slate-700'
                                    }
                                `}
                            >
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                    <span className="font-mono text-purple-400 flex-shrink-0">{account.code}</span>
                                    <span className="truncate">{account.name}</span>
                                </div>
                                {account.accountType && (
                                    <span className="text-xs text-slate-500 flex-shrink-0">{account.accountType}</span>
                                )}
                                {value?.code === account.code && (
                                    <Check size={14} className="text-purple-400 flex-shrink-0" />
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer with count */}
                {filteredAccounts.length > 0 && (
                    <div className="px-3 py-1.5 text-xs text-slate-500 border-t border-slate-700 bg-slate-800/95">
                        {filteredAccounts.length === accounts.length
                            ? `${accounts.length} accounts`
                            : `${filteredAccounts.length} of ${accounts.length} accounts`
                        }
                    </div>
                )}
            </div>
        );

        return createPortal(menu, document.body);
    };

    return (
        <>
            {/* Trigger Button */}
            <div
                ref={buttonRef}
                onClick={toggleDropdown}
                className={`
                    w-full px-3 py-2 bg-slate-800 border rounded-lg text-sm flex items-center justify-between gap-2 cursor-pointer transition-colors min-w-0
                    ${disabled ? 'opacity-50 cursor-not-allowed border-slate-700' : 'border-slate-600 hover:border-slate-500'}
                    ${isOpen ? 'ring-2 ring-purple-500 border-purple-500' : ''}
                    ${className}
                `}
            >
                <span className={`truncate ${value ? 'text-white' : 'text-slate-500'}`}>
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            Loading...
                        </span>
                    ) : error ? (
                        'Error loading'
                    ) : (
                        displayValue || placeholder
                    )}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {value && !disabled && (
                        <button
                            onClick={handleClear}
                            className="p-0.5 text-slate-400 hover:text-white rounded"
                        >
                            <X size={14} />
                        </button>
                    )}
                    <ChevronDown
                        size={16}
                        className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                </div>
            </div>

            {/* Portal Menu */}
            {renderMenu()}
        </>
    );
};

export default AccountSelector;
