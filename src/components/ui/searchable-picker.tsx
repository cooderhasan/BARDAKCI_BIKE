"use client"

import * as React from "react"
import { Search, ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface SearchablePickerProps {
  options: string[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  title?: string
  disabled?: boolean
  className?: string
}

export function SearchablePicker({
  options,
  value,
  onValueChange,
  placeholder = "Seçiniz...",
  searchPlaceholder = "Ara...",
  emptyMessage = "Sonuç bulunamadı.",
  title = "Seçim Yapın",
  disabled = false,
  className,
}: SearchablePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isMobile, setIsMobile] = React.useState(false)

  // Detect mobile for responsive behavior
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const filteredOptions = options.filter((option) =>
    option.toLocaleLowerCase("tr-TR").includes(searchQuery.toLocaleLowerCase("tr-TR"))
  )

  const handleSelect = (option: string) => {
    onValueChange(option)
    setOpen(false)
    setSearchQuery("")
  }

  const PickerContent = (
    <div className="flex flex-col h-full max-h-[inherit]">
      <div className="p-3 border-b shrink-0 bg-white dark:bg-gray-950 sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 text-sm"
            autoFocus
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-[200px] max-h-[400px]">
        <div className="p-1">
          {filteredOptions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          ) : (
            <div className="grid gap-0.5">
              {filteredOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 text-sm text-left rounded-md transition-colors hover:bg-accent",
                    value === option && "bg-accent font-medium text-accent-foreground"
                  )}
                >
                  <span className="truncate pr-2">{option}</span>
                  {value === option && (
                    <Check className="h-4 w-4 text-[#17457C] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 12px;
          display: block !important;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8f9fa;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #adb5bd;
          border-radius: 10px;
          border: 3px solid #f8f9fa;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #868e96;
        }
      `}</style>
    </div>
  )

  const Trigger = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      className={cn(
        "w-full justify-between font-normal bg-white dark:bg-gray-950 h-10 px-3",
        !value && "text-muted-foreground",
        className
      )}
    >
      <span className="truncate">{value || placeholder}</span>
      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {Trigger}
        </SheetTrigger>
        <SheetContent 
          side="bottom" 
          className="h-[85vh] p-0 flex flex-col rounded-t-2xl"
        >
          <SheetHeader className="p-4 border-b shrink-0">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            {PickerContent}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {Trigger}
      </PopoverTrigger>
      <PopoverContent 
        align="start"
        side="top"
        sideOffset={4}
        className="p-0 w-[var(--radix-popover-trigger-width)] overflow-hidden shadow-xl"
      >
        {PickerContent}
      </PopoverContent>
    </Popover>
  )
}
