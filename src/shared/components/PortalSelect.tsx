import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface PortalSelectOption {
    value: string;
    label: string;
    sublabel?: string;
}

interface PortalSelectProps {
    options: PortalSelectOption[];
    value: string | null;
    onChange: (value: string | null, option: PortalSelectOption | null) => void;
    placeholder?: string;
    searchable?: boolean;
    searchPlaceholder?: string;
    disabled?: boolean;
    className?: string;
    loading?: boolean;
    clearable?: boolean;
}

/**
 * PortalSelect - A dropdown that renders via React Portal
 * Solves overflow:hidden clipping issues in tables and modals
 */
const PortalSelect: React.FC<PortalSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    searchable = false,
    searchPlaceholder = 'Search...',
    disabled = false,
    className = '',
    loading = false,
    clearable = true,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });

    const buttonRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Find selected option
    const selectedOption = options.find(opt => opt.value === value);

    // Filter options based on search
    const filteredOptions = searchQuery
        ? options.filter(opt =>
            opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            opt.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
            opt.sublabel?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : options;

    // Calculate menu position
    const updatePosition = useCallback(() => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const scrollY = window.scrollY;
            const scrollX = window.scrollX;

            // Check if there's room below, otherwise open above
            const spaceBelow = window.innerHeight - rect.bottom;
            const menuHeight = Math.min(filteredOptions.length * 36 + (searchable ? 50 : 0), 300);
            const openAbove = spaceBelow < menuHeight && rect.top > menuHeight;

            setMenuPosition({
                top: openAbove
                    ? scrollY + rect.top - menuHeight - 4
                    : scrollY + rect.bottom + 4,
                left: scrollX + rect.left,
                width: Math.max(rect.width, 280), // Minimum width for better UX
            });
        }
    }, [filteredOptions.length, searchable]);

    // Update position on open and scroll/resize
    useEffect(() => {
        if (isOpen) {
            updatePosition();

            const handleScrollOrResize = () => updatePosition();
            window.addEventListener('scroll', handleScrollOrResize, true);
            window.addEventListener('resize', handleScrollOrResize);

            // Focus search input when opening
            if (searchable) {
                setTimeout(() => searchInputRef.current?.focus(), 0);
            }

            return () => {
                window.removeEventListener('scroll', handleScrollOrResize, true);
                window.removeEventListener('resize', handleScrollOrResize);
            };
        }
    }, [isOpen, updatePosition, searchable]);

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

    // Close on Escape key
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

    // Handle selection
    const handleSelect = (option: PortalSelectOption) => {
        onChange(option.value, option);
        setIsOpen(false);
        setSearchQuery('');
    };

    // Handle clear
    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null, null);
    };

    // Toggle dropdown
    const toggleDropdown = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
            if (isOpen) {
                setSearchQuery('');
            }
        }
    };

    // Render the floating menu via portal
    const renderMenu = () => {
        if (!isOpen) return null;

        const menu = (
            <div
                ref={menuRef}
                className="fixed bg-slate-800 border border-slate-600 rounded-lg shadow-2xl overflow-hidden"
                style={{
                    top: menuPosition.top,
                    left: menuPosition.left,
                    width: menuPosition.width,
                    zIndex: 9999,
                }}
            >
                {/* Search Input */}
                {searchable && (
                    <div className="p-2 border-b border-slate-700">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-900/50 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                )}

                {/* Options List */}
                <div className="max-h-60 overflow-y-auto">
                    {loading ? (
                        <div className="px-3 py-4 text-sm text-slate-500 text-center">
                            Loading...
                        </div>
                    ) : filteredOptions.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-slate-500 text-center">
                            {searchQuery ? 'No matches found' : 'No options available'}
                        </div>
                    ) : (
                        filteredOptions.map((option) => (
                            <div
                                key={option.value}
                                onClick={() => handleSelect(option)}
                                className={`
                                    px-3 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between
                                    ${value === option.value
                                        ? 'bg-purple-600/20 text-purple-300'
                                        : 'text-slate-300 hover:bg-slate-700'
                                    }
                                `}
                            >
                                <div className="flex-1 min-w-0">
                                    <span className="font-mono text-purple-400 mr-2">{option.value}</span>
                                    <span className="truncate">{option.label}</span>
                                </div>
                                {option.sublabel && (
                                    <span className="text-xs text-slate-500 ml-2">{option.sublabel}</span>
                                )}
                                {value === option.value && (
                                    <Check size={14} className="text-purple-400 ml-2 flex-shrink-0" />
                                )}
                            </div>
                        ))
                    )}
                </div>
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
                    w-full px-3 py-2 bg-slate-800 border rounded-lg text-sm flex items-center justify-between gap-2 cursor-pointer transition-colors
                    ${disabled ? 'opacity-50 cursor-not-allowed border-slate-700' : 'border-slate-600 hover:border-slate-500'}
                    ${isOpen ? 'ring-2 ring-purple-500 border-purple-500' : ''}
                    ${className}
                `}
            >
                <span className={`truncate ${selectedOption ? 'text-white' : 'text-slate-500'}`}>
                    {loading
                        ? 'Loading...'
                        : selectedOption
                            ? `${selectedOption.value} - ${selectedOption.label}`
                            : placeholder
                    }
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {clearable && selectedOption && !disabled && (
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

export default PortalSelect;
