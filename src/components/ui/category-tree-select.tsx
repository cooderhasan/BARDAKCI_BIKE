"use client";

import * as React from "react";
import { useState, useMemo, useRef, useEffect } from "react";
import { Check, X, Search, ChevronRight, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CategoryOption {
    id: string;
    name: string;
    parentId: string | null;
}

interface CategoryTreeSelectProps {
    options: CategoryOption[];
    selected: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    /**
     * Alt kategori seçilince üst kategorileri de seç (ürün formu: "Fren - Vites Grubu" → "Bisiklet Yedek Parça" da).
     * Toplu işlem formlarında kapalı: orada üst kategorinin eklenmesi işlemi tüm üst kategoriye yayardı.
     */
    autoSelectParents?: boolean;
}

/**
 * Kategori seçici: tüm kategoriler girintili ağaç halinde (açılıp kapanır), kutucuk seçer, satır adı alt kategorileri açar.
 * Aramada sonuçlar yoluyla ("Bisiklet Yedek Parça › Fren - Vites Grubu") görünür; arama seçimden sonra da açık kalır.
 * Önceden kademeli menüydü: satıra tıklamak hem seçiyor hem alt seviyeye geçiyordu, iki kategori için iki kez aranıyordu.
 */
export function CategoryTreeSelect({
    options,
    selected,
    onChange,
    placeholder = "Kategori seçin...",
    autoSelectParents = false,
}: CategoryTreeSelectProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
    const childrenOf = useMemo(() => {
        const m = new Map<string | null, CategoryOption[]>();
        for (const o of options) {
            const key = o.parentId && byId.has(o.parentId) ? o.parentId : null;
            if (!m.has(key)) m.set(key, []);
            m.get(key)!.push(o);
        }
        return m;
    }, [options, byId]);

    /** Üst kategoriler (yakından uzağa) */
    const ancestorsOf = (id: string): CategoryOption[] => {
        const out: CategoryOption[] = [];
        let cur = byId.get(id);
        const seen = new Set<string>();
        while (cur?.parentId && byId.has(cur.parentId) && !seen.has(cur.parentId)) {
            seen.add(cur.parentId);
            cur = byId.get(cur.parentId)!;
            out.push(cur);
        }
        return out;
    };
    const pathOf = (id: string) => [...ancestorsOf(id).reverse().map((a) => a.name), byId.get(id)?.name || id].join(" › ");

    // Seçili kategorilerin üstleri açık başlasın (formu açınca nerede olduğu görünsün)
    useEffect(() => {
        if (!open) return;
        setExpanded((prev) => {
            const next = new Set(prev);
            for (const id of selected) for (const a of ancestorsOf(id)) next.add(a.id);
            return next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const searchResults = useMemo(() => {
        const q = searchQuery.trim().toLocaleLowerCase("tr-TR");
        if (!q) return [];
        return options.filter((c) => c.name.toLocaleLowerCase("tr-TR").includes(q));
    }, [options, searchQuery]);

    const toggleSelect = (id: string) => {
        if (selected.includes(id)) {
            onChange(selected.filter((s) => s !== id));
            return;
        }
        const add = [id];
        if (autoSelectParents) for (const a of ancestorsOf(id)) if (!selected.includes(a.id)) add.push(a.id);
        onChange([...selected, ...add]);
    };

    const toggleExpand = (id: string) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const Checkbox = ({ checked }: { checked: boolean }) => (
        <div className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${checked ? "bg-primary border-primary" : "border-input"}`}>
            {checked && <Check className="h-3 w-3 text-primary-foreground" />}
        </div>
    );

    const renderNode = (cat: CategoryOption, depth: number): React.ReactNode => {
        const kids = childrenOf.get(cat.id) || [];
        const isOpen = expanded.has(cat.id);
        const isSelected = selected.includes(cat.id);
        const selectedInside = kids.length > 0 && !isOpen && selected.some((s) => ancestorsOf(s).some((a) => a.id === cat.id));
        return (
            <React.Fragment key={cat.id}>
                <div className="flex items-center rounded-sm hover:bg-accent transition-colors" style={{ paddingLeft: depth * 18 }}>
                    {/* Ok: alt kategorileri aç/kapat */}
                    <button
                        type="button"
                        onClick={() => kids.length > 0 && toggleExpand(cat.id)}
                        className={`w-7 h-8 flex items-center justify-center shrink-0 ${kids.length > 0 ? "text-muted-foreground hover:text-foreground" : "invisible"}`}
                        aria-label={isOpen ? "Kapat" : "Alt kategorileri aç"}
                    >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    {/* Kutucuk + ad: seçer */}
                    <button type="button" onClick={() => toggleSelect(cat.id)} className="flex-1 flex items-center gap-2 py-1.5 pr-3 text-left">
                        <Checkbox checked={isSelected} />
                        <span className={`text-sm ${isSelected ? "font-medium" : ""}`}>{cat.name}</span>
                        {kids.length > 0 && <span className="text-xs text-muted-foreground">({kids.length})</span>}
                        {selectedInside && <span className="text-[10px] font-semibold text-primary">• içinde seçili</span>}
                    </button>
                </div>
                {isOpen && kids.map((k) => renderNode(k, depth + 1))}
            </React.Fragment>
        );
    };

    return (
        <div className="relative" ref={containerRef}>
            {/* Seçilenler: hepsi görünür, üzerine gelince yolu */}
            <div className="min-h-10 border border-input rounded-md p-2 flex flex-wrap gap-1 cursor-pointer" onClick={() => setOpen(!open)}>
                {selected.length === 0 ? (
                    <span className="text-muted-foreground text-sm">{placeholder}</span>
                ) : (
                    selected.map((id) => (
                        <Badge key={id} variant="secondary" className="gap-1 max-w-[260px]" title={pathOf(id)}>
                            <span className="truncate">{byId.get(id)?.name || id}</span>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange(selected.filter((s) => s !== id));
                                }}
                                className="hover:bg-muted rounded-full flex-shrink-0"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))
                )}
            </div>

            {open && (
                <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg">
                    <div className="p-2 border-b">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Kategori ara..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 pr-8" autoFocus />
                            {searchQuery && (
                                <button type="button" onClick={() => setSearchQuery("")} className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground" aria-label="Aramayı temizle">
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        {autoSelectParents && (
                            <p className="text-[11px] text-muted-foreground mt-1.5 px-1">Alt kategori seçince üst kategorisi de otomatik seçilir; istemezseniz üstteki etiketten kaldırın.</p>
                        )}
                    </div>

                    <ScrollArea className="h-80">
                        <div className="p-1">
                            {searchQuery ? (
                                searchResults.length === 0 ? (
                                    <div className="text-sm text-muted-foreground p-2">Sonuç bulunamadı</div>
                                ) : (
                                    searchResults.map((cat) => {
                                        const anc = ancestorsOf(cat.id).reverse();
                                        const isSelected = selected.includes(cat.id);
                                        return (
                                            <button
                                                type="button"
                                                key={cat.id}
                                                className="w-full flex items-center gap-2 py-2 px-3 hover:bg-accent rounded-sm text-left"
                                                onClick={() => toggleSelect(cat.id)}
                                            >
                                                <Checkbox checked={isSelected} />
                                                <span className="text-sm">
                                                    {anc.length > 0 && <span className="text-muted-foreground">{anc.map((a) => a.name).join(" › ")} › </span>}
                                                    <span className={isSelected ? "font-medium" : ""}>{cat.name}</span>
                                                </span>
                                            </button>
                                        );
                                    })
                                )
                            ) : (
                                (childrenOf.get(null) || []).map((c) => renderNode(c, 0))
                            )}
                        </div>
                    </ScrollArea>

                    <div className="px-3 py-2 border-t text-xs text-muted-foreground flex justify-between items-center gap-2">
                        <span>{selected.length} kategori seçildi</span>
                        <div className="flex items-center gap-3">
                            {selected.length > 0 && (
                                <button type="button" className="text-destructive hover:underline" onClick={() => onChange([])}>
                                    Tümünü temizle
                                </button>
                            )}
                            <button type="button" className="font-semibold text-foreground hover:underline" onClick={() => setOpen(false)}>
                                Tamam
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
