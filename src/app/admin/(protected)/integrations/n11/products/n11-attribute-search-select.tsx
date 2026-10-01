"use client";

import * as React from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface N11AttributeSearchSelectProps {
  values: any[];
  attrName: string;
  value?: { id: number | string | null; name: string } | null;
  onValueChange: (val: { id: number | string | null; name: string } | null) => void;
  isMissing?: boolean;
}

export function N11AttributeSearchSelect({
  values,
  attrName,
  value,
  onValueChange,
  isMissing = false,
}: N11AttributeSearchSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  // Normalize all options into consistent { id, name, original }
  const options = React.useMemo(() => {
    return values.map((v) => {
      const name =
        typeof v === "object"
          ? v?.attributeValue || v?.name || v?.value || String(v)
          : String(v);
      const id = typeof v === "object" ? v?.id || v?.attributeValueId : null;
      return { id, name: String(name), original: v };
    });
  }, [values]);

  // Filter options based on searchTerm
  const filteredOptions = React.useMemo(() => {
    if (!searchTerm.trim()) return options;
    const q = searchTerm.toLocaleLowerCase("tr");
    return options.filter((opt) => opt.name.toLocaleLowerCase("tr").includes(q));
  }, [options, searchTerm]);

  const handleSelect = (opt: { id: number | string | null; name: string }) => {
    onValueChange({ id: opt.id, name: opt.name });
    setOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange(null);
    setSearchTerm("");
  };

  const displayLabel = value?.name || "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-9 text-xs font-normal border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 rounded-xl min-w-0 shadow-xs transition-colors",
            isMissing && "border-red-300 bg-red-50/40 dark:bg-red-950/20",
            !displayLabel && "text-muted-foreground"
          )}
        >
          <span className="truncate flex-1 min-w-0 text-left mr-2">
            {displayLabel || `${attrName} seçin...`}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {displayLabel && (
              <span
                role="button"
                onClick={handleClear}
                className="hover:text-red-500 p-0.5 rounded-full"
                title="Temizle"
              >
                <X className="h-3.5 w-3.5 opacity-60" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        avoidCollisions={true}
        collisionPadding={12}
        className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[260px] max-w-[calc(100vw-2rem)] overflow-hidden shadow-2xl border-purple-100 dark:border-purple-900/50 rounded-2xl bg-white dark:bg-gray-900 z-[120]"
      >
        <div className="p-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80 sticky top-0 z-10">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={`${attrName} ara...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus-visible:ring-purple-500 rounded-lg"
              autoFocus
            />
          </div>
        </div>

        <div className="overflow-y-auto overscroll-contain max-h-[250px] p-1.5 space-y-0.5">
          {filteredOptions.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Sonuç bulunamadı.
            </p>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected =
                value?.name === opt.name ||
                (opt.id !== null && value?.id !== null && opt.id === value?.id);

              return (
                <button
                  key={`${opt.id ?? idx}-${opt.name}`}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-xs text-left rounded-xl transition-colors hover:bg-purple-50 dark:hover:bg-purple-950/30",
                    isSelected &&
                      "bg-purple-100/80 dark:bg-purple-900/40 text-purple-900 dark:text-purple-200 font-semibold"
                  )}
                >
                  <span className="truncate pr-2">{opt.name}</span>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
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
