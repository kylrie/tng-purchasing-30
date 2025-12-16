import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Search } from 'lucide-react';

interface Option {
    value: string;
    label: string;
}

interface SearchableDropdownProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

/**
 * SearchableDropdown Component - Portal-based for table overflow safety
 * Uses React Portal to render menu at document.body level (same as AccountSelector)
 */
const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
    options,
    value,
    onChange,
    placeholder = "Select an option",
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0, openAbove: false });

    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Initialize search term if value is present
    useEffect(() => {
        const selectedOption = options.find(opt => opt.value === value);
        if (selectedOption) {
            setSearchTerm(selectedOption.label);
        } else {
            if (!value) setSearchTerm('');
        }
    }, [value, options]);

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;

        return options.filter(option =>
            option.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [options, searchTerm]);

    // Calculate menu position
    const updatePosition = useCallback(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const scrollY = window.scrollY;
            const scrollX = window.scrollX;

            // Calculate menu height (approx 36px per item + 50px for search)
            const menuHeight = Math.min(filteredOptions.length * 36 + 50, 280);
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const openAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;

            setMenuPosition({
                top: openAbove
                    ? scrollY + rect.top - menuHeight - 4
                    : scrollY + rect.bottom + 4,
                left: scrollX + rect.left,
                width: Math.max(rect.width, 280), // Minimum width for readability
                openAbove,
            });
        }
    }, [filteredOptions.length]);

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
                containerRef.current &&
                menuRef.current &&
                !containerRef.current.contains(event.target as Node) &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
                // Reset search term to selected value label
                const selectedOption = options.find(opt => opt.value === value);
                if (selectedOption) {
                    setSearchTerm(selectedOption.label);
                } else {
                    setSearchTerm('');
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, value, options]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                setIsOpen(false);
                const selectedOption = options.find(opt => opt.value === value);
                setSearchTerm(selectedOption?.label || '');
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, value, options]);

    const handleSelect = (option: Option) => {
        onChange(option.value);
        setSearchTerm(option.label);
        setIsOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setIsOpen(true);
        if (e.target.value === '') {
            onChange('');
        }
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSearchTerm('');
        setIsOpen(true);
    };

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
        if (isOpen) {
            const selectedOption = options.find(opt => opt.value === value);
            setSearchTerm(selectedOption?.label || '');
        }
    };

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
                            value={searchTerm}
                            onChange={handleInputChange}
                            placeholder="Type to search..."
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-900/50 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>

                {/* Options List */}
                <div className="max-h-52 overflow-y-auto">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((option) => (
                            <div
                                key={option.value}
                                onClick={() => handleSelect(option)}
                                className={`
                                    px-3 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between gap-2
                                    ${option.value === value
                                        ? 'bg-purple-600/20 text-purple-300'
                                        : 'text-slate-300 hover:bg-slate-700'
                                    }
                                `}
                            >
                                <span className="truncate">{option.label}</span>
                                {option.value === value && <span className="w-1.5 h-1.5 bg-purple-500 rounded-full flex-shrink-0"></span>}
                            </div>
                        ))
                    ) : (
                        <div className="px-3 py-4 text-sm text-slate-500 text-center">No options found</div>
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
                ref={containerRef}
                onClick={toggleDropdown}
                className={`
                    w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs cursor-pointer transition-colors flex items-center justify-between gap-1 min-w-0
                    ${isOpen ? 'ring-1 ring-purple-500 border-purple-500' : 'hover:border-slate-500'}
                    ${className}
                `}
            >
                <span className={`truncate ${value ? 'text-white' : 'text-slate-500'}`}>
                    {searchTerm || placeholder}
                </span>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                    {value && (
                        <button onClick={handleClear} className="p-0.5 text-slate-400 hover:text-white">
                            <X size={12} />
                        </button>
                    )}
                    <ChevronDown
                        size={14}
                        className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                </div>
            </div>

            {/* Portal Menu */}
            {renderMenu()}
        </>
    );
};

export default SearchableDropdown;
