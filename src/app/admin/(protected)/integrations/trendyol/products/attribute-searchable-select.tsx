"use client";

import * as React from "react";
import { Search, ChevronDown, Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface AttributeOption {
  id: number | string;
  name: string;
}

interface AttributeSearchableSelectProps {
  options: AttributeOption[];
  value?: number | string;
  onValueChange: (val: number | string, option?: AttributeOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  allowCustom?: boolean;
  disabled?: boolean;
  className?: string;
}

export function AttributeSearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Seçiniz...",
  searchPlaceholder = "Arayın...",
  allowCustom = false,
  disabled = false,
  className,
}: AttributeSearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Find currently selected option
  const selectedOption = React.useMemo(() => {
    if (value === undefined || value === null || value === "") return null;
    return options.find(
      (opt) => String(opt.id) === String(value) || opt.name === String(value)
    );
  }, [options, value]);

  // Display label
  const displayLabel = selectedOption
    ? selectedOption.name
    : value !== undefined && value !== null && value !== ""
    ? String(value)
    : "";

  // Filter options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLocaleLowerCase("tr-TR");
    return options.filter((opt) =>
      opt.name.toLocaleLowerCase("tr-TR").includes(query)
    );
  }, [options, searchQuery]);

  const handleSelect = (option: AttributeOption) => {
    onValueChange(option.id, option);
    setOpen(false);
    setSearchQuery("");
  };

  const handleSelectCustom = () => {
    if (!searchQuery.trim()) return;
    onValueChange(searchQuery.trim(), { id: searchQuery.trim(), name: searchQuery.trim() });
    setOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange("");
    setSearchQuery("");
  };

  // Check if current search query exactly matches an existing option
  const exactMatch = filteredOptions.some(
    (opt) => opt.name.toLocaleLowerCase("tr-TR") === searchQuery.trim().toLocaleLowerCase("tr-TR")
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal bg-white dark:bg-gray-800 h-10 px-3 text-left border-gray-200 dark:border-gray-700 rounded-xl shadow-xs",
            !displayLabel && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{displayLabel || placeholder}</span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {displayLabel && (
              <span
                role="button"
                onClick={handleClear}
                className="hover:text-red-500 p-0.5 rounded-full"
              >
                <X className="h-3.5 w-3.5 opacity-60" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[280px] max-w-[90vw] overflow-hidden shadow-2xl border-orange-100 dark:border-orange-900/50 rounded-2xl bg-white dark:bg-gray-900 z-[100]"
      >
        <div className="p-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80 sticky top-0 z-10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus-visible:ring-orange-500 rounded-lg"
              autoFocus
            />
          </div>
        </div>

        <div className="overflow-y-auto max-h-[260px] p-1.5 space-y-0.5">
          {allowCustom && searchQuery.trim() && !exactMatch && (
            <button
              type="button"
              onClick={handleSelectCustom}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 rounded-xl transition-colors mb-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>"{searchQuery.trim()}" olarak özel ekle</span>
            </button>
          )}

          {filteredOptions.length === 0 && (!allowCustom || !searchQuery.trim()) ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Sonuç bulunamadı.
            </p>
          ) : (
            filteredOptions.map((option) => {
              const isSelected =
                String(option.id) === String(value) ||
                option.name === String(value);

              return (
                <button
                  key={String(option.id)}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-xs text-left rounded-xl transition-colors hover:bg-orange-50 dark:hover:bg-orange-950/30",
                    isSelected &&
                      "bg-orange-100/80 dark:bg-orange-900/40 text-orange-900 dark:text-orange-200 font-semibold"
                  )}
                >
                  <span className="truncate pr-2">{option.name}</span>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
