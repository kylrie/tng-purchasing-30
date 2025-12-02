import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, X } from 'lucide-react';

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

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
    options,
    value,
    onChange,
    placeholder = "Select an option",
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize search term if value is present
    useEffect(() => {
        const selectedOption = options.find(opt => opt.value === value);
        if (selectedOption) {
            setSearchTerm(selectedOption.label);
        } else {
            // Only clear if the user hasn't typed something that might be a new search
            // But this effect runs when value changes.
            // If value becomes empty externally, we clear.
            if (!value) setSearchTerm('');
        }
    }, [value, options]);

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        
        return options.filter(option => 
            option.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [options, searchTerm]);

    const handleSelect = (option: Option) => {
        onChange(option.value);
        setSearchTerm(option.label);
        setIsOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setIsOpen(true);
        // If user clears input, we might want to clear selection or just let them search
        if (e.target.value === '') {
            onChange('');
        }
    };

    const handleFocus = () => {
        setIsOpen(true);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSearchTerm('');
        setIsOpen(true); // Keep open to show full list
    };

    const toggleDropdown = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isOpen) {
            setIsOpen(false);
        } else {
            setIsOpen(true);
        }
    };

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                // Reset search term to selected value label if strictly leaving and no valid new selection made
                // This prevents "half typed" searches from staying in the input visually when not selected
                const selectedOption = options.find(opt => opt.value === value);
                if (selectedOption) {
                     setSearchTerm(selectedOption.label);
                } else {
                    // If no value selected, keep the text? Or clear it?
                    // Usually clear it if it's not a valid selection.
                    // But if we want to allow custom values (not requested here), we'd keep it.
                    // Here we want strict selection.
                    setSearchTerm('');
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [value, options]);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div className="relative group">
                <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-500 pr-10"
                    placeholder={placeholder}
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400">
                     {value && (
                        <button onClick={handleClear} className="hover:text-white p-1">
                            <X size={14} />
                        </button>
                    )}
                    <button onClick={toggleDropdown} className="p-1 hover:text-white">
                        <ChevronDown size={16} />
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((option) => (
                            <button
                                key={option.value}
                                className={`w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors flex justify-between items-center text-sm ${option.value === value ? 'bg-slate-700/50 text-blue-400' : 'text-slate-200'}`}
                                onClick={() => handleSelect(option)}
                            >
                                <span>{option.label}</span>
                                {option.value === value && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>}
                            </button>
                        ))
                    ) : (
                        <div className="px-3 py-2 text-slate-500 text-sm">No options found</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableDropdown;
