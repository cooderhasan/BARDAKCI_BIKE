
"use client";

import { useState, useEffect } from "react";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Search, 
    Send, 
    RefreshCcw, 
    AlertCircle, 
    CheckCircle2, 
    Box,
    Link2
} from "lucide-react";
import { toast } from "sonner";
import { sendProductToHepsiburada, getHepsiburadaCategoryAttributes, getHepsiburadaAttributeValues, updateHepsiburadaSku } from "../actions";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function DynamicAttributeField({ attr, categoryId, onChange, product }: { attr: any, categoryId: string, onChange: (val: string, name: string) => void, product: any }) {
    const [values, setValues] = useState<{id: string, value: string}[]>([]);
    const [loading, setLoading] = useState(false);
    const [isManual, setIsManual] = useState(false);

    useEffect(() => {
        if (attr.type === 'enum' && !isManual) {
            setLoading(true);
            getHepsiburadaAttributeValues(categoryId, attr.id).then(res => {
                if (res.success) setValues(res.data);
                setLoading(false);
            });
        }
        // Paket görseli zorunluysa ve boşsa ana görseli öner
        if (attr.name.includes("Paket Görseli") && product?.images?.[0]) {
            onChange(product.images[0], attr.name);
        }
    }, [attr.id, categoryId, attr.type, isManual]);

    if (attr.type === 'enum' && !isManual) {
        return (
            <div className="space-y-1">
                <div className="flex justify-between items-center">
                    <Label className="text-xs">{attr.name} {attr.mandatory && "*"}</Label>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-4 text-[9px] text-blue-500 hover:text-blue-700 p-0"
                        onClick={() => setIsManual(true)}
                    >
                        Elle Gir
                    </Button>
                </div>
                <Select onValueChange={(val) => onChange(val, attr.name)} disabled={loading}>
                    <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder={loading ? "Yükleniyor..." : `${attr.name} seçin...`} />
                    </SelectTrigger>
                    <SelectContent>
                        {values.map((v) => (
                            <SelectItem key={v.id} value={v.value}>{v.value}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            <div className="flex justify-between items-center">
                <Label className="text-xs">{attr.name} {attr.mandatory && "*"}</Label>
                {attr.type === 'enum' && (
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-4 text-[9px] text-blue-500 hover:text-blue-700 p-0"
                        onClick={() => setIsManual(false)}
                    >
                        Listeden Seç
                    </Button>
                )}
            </div>
            <Input 
                className="h-8 text-sm"
                placeholder={`${attr.name} değerini girin...`}
                defaultValue={attr.name.includes("Paket Görseli") ? product?.images?.[0] : ""}
                onChange={(e) => onChange(e.target.value, attr.name)}
            />
        </div>
    );
}

interface HepsiburadaProductListProps {
    initialProducts: any[];
}

export function HepsiburadaProductList({ initialProducts }: HepsiburadaProductListProps) {
    const [search, setSearch] = useState("");
    const [products, setProducts] = useState(initialProducts);
    const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
    
    const [showAttrModal, setShowAttrModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [hbSku, setHbSku] = useState("");
    const [categoryAttrs, setCategoryAttrs] = useState<any[]>([]);
    const [attrMappings, setAttrMappings] = useState<any>({});
    const [attrLoading, setAttrLoading] = useState(false);

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(search.toLowerCase())
    );

    const handleOpenWizard = async (product: any) => {
        const mappedCat = product.categories.find((c: any) => c.hbCategoryId !== null && c.hbCategoryId !== undefined);
        if (!mappedCat) {
            toast.error("Önce kategoriyi Hepsiburada ile eşleştirmelisiniz.");
            return;
        }

        setSelectedProduct(product);
        setHbSku(product.hepsiburadaProduct?.hbSku || "");
        setShowAttrModal(true);
        setAttrLoading(true);
        setAttrMappings({});

        try {
            const res = await getHepsiburadaCategoryAttributes(mappedCat.hbCategoryId);
            if (res.success) {
                setCategoryAttrs(res.data || []);
            } else {
                // Metadata çekilemezse uyarı ver ama formu kapat değil
                toast.warning("Kategori özellikleri alınamadı. Temel alanları doldurarak devam edebilirsiniz.");
                setCategoryAttrs([]);
            }
        } catch (error) {
            toast.warning("Kategori özellikleri yüklenemedi. Temel alanlarla devam edebilirsiniz.");
            setCategoryAttrs([]);
        } finally {
            setAttrLoading(false);
        }
    };

    const handleSend = async () => {
        if (!selectedProduct) return;
        
        const finalAttrs = Object.entries(attrMappings).map(([id, data]: any) => ({
            id,
            name: data.name,
            value: data.value
        }));

        setLoadingProductId(selectedProduct.id);
        setShowAttrModal(false);

        try {
            // HB SKU girildiyse veritabanına kaydet
        if (hbSku) {
            await updateHepsiburadaSku(selectedProduct.id, hbSku);
        }

        const res = await sendProductToHepsiburada(selectedProduct.id, finalAttrs);
            if (res.success) {
                toast.success(res.message);
                setProducts(prev => prev.map(p => 
                    p.id === selectedProduct.id 
                    ? { ...p, hepsiburadaProduct: { isSynced: true, lastSyncedAt: new Date() } }
                    : p
                ));
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error("Gönderim sırasında hata oluştu.");
        } finally {
            setLoadingProductId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4 bg-white dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                        placeholder="HB ürünlerini ara..." 
                        className="pl-10 border-none bg-gray-50 dark:bg-gray-800/50 focus-visible:ring-blue-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-gray-50/50 dark:bg-gray-800/50">
                        <TableRow>
                            <TableHead className="w-[80px]">Görsel</TableHead>
                            <TableHead>Ürün</TableHead>
                            <TableHead>HB Fiyat</TableHead>
                            <TableHead>Katalog</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead className="text-right">İşlem</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProducts.map((product) => {
                            const isSynced = !!product.hepsiburadaProduct?.isSynced;
                            const mappedCat = product.categories.find((c: any) => c.hbCategoryId !== null && c.hbCategoryId !== undefined);

                            return (
                                <TableRow key={product.id} className="hover:bg-blue-50/10 transition-colors">
                                    <TableCell>
                                        <img src={product.images?.[0]} className="w-12 h-12 object-cover rounded-lg border" />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm line-clamp-1">{product.name}</span>
                                            <span className="text-[10px] text-muted-foreground font-mono">{product.sku || product.barcode}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm font-bold text-blue-600">
                                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(product.hepsiburadaPrice || product.listPrice))}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {mappedCat ? (
                                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-none text-[10px]">
                                                Katalog Hazır
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-amber-500 text-[10px]">Kategori Bekliyor</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {isSynced ? (
                                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <AlertCircle className="w-4 h-4 text-amber-500" />
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {isSynced ? (
                                                <Button size="sm" variant="outline" className="h-8 border-blue-200 text-blue-600" onClick={() => handleOpenWizard(product)} disabled={loadingProductId === product.id}>
                                                    <RefreshCcw className="w-3 h-3 mr-1" />
                                                    Güncelle
                                                </Button>
                                            ) : (
                                                <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleOpenWizard(product)} disabled={loadingProductId === product.id || !mappedCat}>
                                                    <Link2 className="w-3 h-3 mr-1" />
                                                    HB Kataloğuna Gönder
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={showAttrModal} onOpenChange={setShowAttrModal}>
                <DialogContent className="rounded-3xl border-blue-100 dark:border-blue-900/30">
                    <DialogHeader>
                        <DialogTitle>HB Katalog Eşleştirme</DialogTitle>
                        <DialogDescription>HB Kataloğu için zorunlu teknik detayları doldurun.</DialogDescription>
                    </DialogHeader>

                    {attrLoading ? (
                        <div className="py-8 flex justify-center"><RefreshCcw className="animate-spin text-blue-500" /></div>
                    ) : (
                        <div className="space-y-4 py-4 max-h-[50vh] overflow-y-auto">
                            {/* Temel Zorunlu Alanlar */}
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl space-y-3 border border-blue-100 dark:border-blue-900/30">
                                <h4 className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Temel Bilgiler</h4>
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-semibold">Garanti Süresi (Ay) *</Label>
                                        <Input 
                                            type="number"
                                            className="h-8 text-sm border-amber-200 focus-visible:ring-amber-500"
                                            defaultValue="24"
                                            onChange={(e) => setAttrMappings((prev: any) => ({ ...prev, "GarantiSuresi": { name: "Garanti Süresi (Ay)", value: e.target.value } }))}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-semibold text-amber-600">HB SKU (Katalog Kodu - Opsiyonel)</Label>
                                        <Input 
                                            className="h-8 text-sm border-amber-200 focus-visible:ring-amber-500"
                                            placeholder="Örn: HBV00000XYZ"
                                            value={hbSku}
                                            onChange={(e) => setHbSku(e.target.value)}
                                        />
                                        <p className="text-[9px] text-muted-foreground italic">Eğer HB kataloğunda ürün varsa kodunu girerek direkt eşleşebilirsiniz.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Kategoriye Özel Alanlar */}
                            {categoryAttrs.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">Kategori Özellikleri</h4>
                                    {categoryAttrs.map((attr: any) => (
                                        <DynamicAttributeField 
                                            key={attr.id} 
                                            attr={attr} 
                                            categoryId={selectedProduct?.categories.find((c: any) => c.hbCategoryId)?.hbCategoryId || ""}
                                            onChange={(val, name) => setAttrMappings((prev: any) => ({ ...prev, [attr.id]: { name, value: val } }))}
                                            product={selectedProduct}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowAttrModal(false)}>İptal</Button>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSend}>Kataloğa Gönder</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
