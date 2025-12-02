import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface ScopedPermissionCellProps {
  label?: string;
  scopes: string[];
  selectedScopes: string[];
  onChange: (newScopes: string[]) => void;
}

export const ScopedPermissionCell: React.FC<ScopedPermissionCellProps> = ({
  scopes,
  selectedScopes,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Derived states
  const isAllSelected = scopes.length > 0 && scopes.every((s) => selectedScopes.includes(s));
  const isSomeSelected = selectedScopes.length > 0 && !isAllSelected;

  // Toggle all
  const handleMainToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange([...scopes]);
    }
  };

  // Toggle individual scope
  const handleScopeToggle = (scope: string) => {
    if (selectedScopes.includes(scope)) {
      onChange(selectedScopes.filter((s) => s !== scope));
    } else {
      onChange([...selectedScopes, scope]);
    }
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-flex items-center gap-1" ref={dropdownRef}>
      {/* Dropdown Toggle Button - The main interactive element */}
      <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={`
            flex items-center gap-2 px-2 py-1 rounded-md text-sm font-medium transition-all
            ${(isAllSelected || isSomeSelected)
                ? 'bg-purple-900/40 text-purple-200 hover:bg-purple-900/60 border border-purple-500/30' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-transparent'
            }
          `}
          title="Configure Scopes"
        >
          {isAllSelected ? (
             <span className="text-xs">All Types</span>
          ) : isSomeSelected ? (
             <span className="text-xs">{selectedScopes.length} Selected</span>
          ) : (
             <span className="text-xs">None</span>
          )}
          
          <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-[100] p-1.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1 mb-1">
            Requisition Types
          </div>
          <div className="space-y-0.5">
            {scopes.map((scope) => {
              const isSelected = selectedScopes.includes(scope);
              return (
                <div
                  key={scope}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleScopeToggle(scope);
                  }}
                  className={`
                    flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors
                    ${isSelected ? 'bg-purple-900/30 text-purple-200' : 'hover:bg-slate-700/50 text-slate-400'}
                  `}
                >
                  <span className="text-sm font-medium">{scope}</span>
                  {isSelected && <Check size={14} className="text-purple-400" />}
                </div>
              );
            })}
          </div>
          
          <div className="h-px bg-slate-700/50 my-1.5" />
          
          <div 
            onClick={handleMainToggle}
            className="flex items-center justify-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-slate-700/50 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
             {isAllSelected ? "Unselect All" : "Select All"}
          </div>
        </div>
      )}
    </div>
  );
};
