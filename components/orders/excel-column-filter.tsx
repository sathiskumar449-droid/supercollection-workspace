"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Search, 
  X, 
  Filter, 
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
  badge?: React.ReactNode;
}

export interface ExcelColumnFilterProps {
  title: string;
  columnKey: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  isActive: boolean;
  
  // Filter types
  filterType?: "checkbox" | "search" | "single_select";

  // Checkbox options
  options?: FilterOption[];
  selectedValues?: string[]; // current applied values (empty array or all means no filter)
  onApplyFilter?: (values: string[]) => void;

  // Text search filter
  searchValue?: string;
  onApplySearch?: (value: string) => void;
  searchPlaceholder?: string;

  // Clear filter
  onClearFilter: () => void;

  // Alignment
  align?: "left" | "right";

  // Deprecated sort props (ignored)
  canSort?: boolean;
  currentSortField?: string;
  currentSortAsc?: boolean;
  sortFieldKey?: string;
  onSort?: (field: any, asc: boolean) => void;
  sortAscLabel?: string;
  sortDescLabel?: string;
}

export function ExcelColumnFilter({
  title,
  columnKey,
  isOpen,
  onToggle,
  onClose,
  isActive,
  filterType = "checkbox",
  options = [],
  selectedValues = [],
  onApplyFilter,
  searchValue = "",
  onApplySearch,
  searchPlaceholder = "Search...",
  onClearFilter,
  align = "left",
}: ExcelColumnFilterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Local state for checkboxes while dropdown is open (committed on Apply)
  const [localSelected, setLocalSelected] = useState<string[]>(selectedValues);
  const [optionSearchQuery, setOptionSearchQuery] = useState("");
  const [localSearchText, setLocalSearchText] = useState(searchValue);

  // Sync local state when dropdown opens or props change
  useEffect(() => {
    if (isOpen) {
      setLocalSelected(selectedValues);
      setLocalSearchText(searchValue);
      setOptionSearchQuery("");
    }
  }, [isOpen, selectedValues, searchValue]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Filtered options based on search query in the dropdown
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(optionSearchQuery.toLowerCase())
  );

  const isAllSelected = 
    options.length > 0 && 
    options.every((opt) => localSelected.includes(opt.value));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setLocalSelected([]);
    } else {
      setLocalSelected(options.map((opt) => opt.value));
    }
  };

  const handleToggleOption = (value: string) => {
    setLocalSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleApply = () => {
    if (filterType === "checkbox" && onApplyFilter) {
      onApplyFilter(localSelected);
    } else if (filterType === "search" && onApplySearch) {
      onApplySearch(localSearchText);
    }
    onClose();
  };

  const handleClear = () => {
    setLocalSelected([]);
    setLocalSearchText("");
    onClearFilter();
    onClose();
  };

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      {/* Excel Filter Button Icon */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          "inline-flex items-center justify-center w-4 h-4 rounded transition-all cursor-pointer select-none",
          isActive
            ? "bg-orange-600 hover:bg-orange-700 text-white shadow-xs ring-1 ring-orange-500"
            : "bg-slate-200/90 hover:bg-slate-300 text-slate-600 hover:text-slate-900 border border-slate-300/80 shadow-2xs"
        )}
        title={isActive ? `Filtered by ${title} (Active - click to edit)` : `Filter ${title}`}
      >
        {isActive ? (
          <Filter className="w-2.5 h-2.5 fill-current" />
        ) : (
          <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.5 2.5h13a.5.5 0 0 1 .38.82l-4.88 5.69v4.49a.5.5 0 0 1-.72.45l-2.5-1.25A.5.5 0 0 1 6.5 12.25V9.01L1.12 3.32a.5.5 0 0 1 .38-.82z" />
          </svg>
        )}
      </button>

      {/* Excel Filter Popover Menu */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute top-full mt-1.5 z-50 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-2 px-2.5 text-xs text-slate-700 font-normal normal-case animate-in fade-in zoom-in-95 duration-100",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[11px] text-slate-800 tracking-tight">
                Filter: {title}
              </span>
              {isActive && (
                <span className="px-1.5 py-0.2 rounded-full bg-orange-100 text-orange-700 font-bold text-[9.5px]">
                  Active
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Clear Filter Shortcut */}
          {isActive && (
            <div className="pb-1.5 border-b border-slate-100 mb-1.5">
              <button
                type="button"
                onClick={handleClear}
                className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-red-600 hover:bg-red-50 font-medium text-[11px] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear filter from &quot;{title}&quot;</span>
              </button>
            </div>
          )}

          {/* Filter Type: Text Search */}
          {filterType === "search" && (
            <div className="space-y-2 py-1">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
                <input
                  type="text"
                  value={localSearchText}
                  onChange={(e) => setLocalSearchText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleApply();
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full text-xs pl-7 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-md outline-none focus:border-orange-500 focus:bg-white text-slate-800 placeholder-slate-400"
                  autoFocus
                />
                {localSearchText && (
                  <button
                    type="button"
                    onClick={() => setLocalSearchText("")}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Filter Type: Checkbox List (Excel Style) */}
          {filterType === "checkbox" && (
            <div className="space-y-1.5">
              {/* Search within options if more than 4 items */}
              {options.length > 4 && (
                <div className="relative flex items-center">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none" />
                  <input
                    type="text"
                    value={optionSearchQuery}
                    onChange={(e) => setOptionSearchQuery(e.target.value)}
                    placeholder="Search in list..."
                    className="w-full text-[11px] pl-6 pr-6 py-1 bg-slate-50 border border-slate-200 rounded outline-none focus:border-orange-500 text-slate-800"
                  />
                  {optionSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setOptionSearchQuery("")}
                      className="absolute right-1.5 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Checkbox List Container */}
              <div className="max-h-44 overflow-y-auto space-y-0.5 border border-slate-100 rounded-md p-1 bg-slate-50/50">
                {/* Select All */}
                <label className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-100 text-xs font-semibold text-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>(Select All)</span>
                </label>

                {/* Option Items */}
                {filteredOptions.length === 0 ? (
                  <div className="text-[11px] text-slate-400 text-center py-3">
                    No matching options
                  </div>
                ) : (
                  filteredOptions.map((opt) => {
                    const isChecked = localSelected.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className={cn(
                          "flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-100 text-xs text-slate-700 cursor-pointer select-none transition-colors",
                          isChecked && "font-medium text-slate-900"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleOption(opt.value)}
                          className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="flex-1 truncate">{opt.label}</span>
                        {opt.count !== undefined && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({opt.count})
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium text-[11px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-3 py-1 rounded bg-orange-600 hover:bg-orange-700 text-white font-bold text-[11px] shadow-2xs transition-colors cursor-pointer"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
