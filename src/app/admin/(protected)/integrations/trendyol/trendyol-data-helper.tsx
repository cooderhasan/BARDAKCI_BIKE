
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTrendyolBrands, getTrendyolCategories } from "./actions";
import { toast } from "sonner";
import { Search, Loader2, Copy } from "lucide-react";

interface TrendyolDataHelperProps {
    isEnabled: boolean;
}

export function TrendyolDataHelper({ isEnabled }: TrendyolDataHelperProps) {
    const [brands, setBrands] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loadingBrands, setLoadingBrands] = useState(false);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [brandSearch, setBrandSearch] = useState("");
    const [categorySearch, setCategorySearch] = useState("");

    const fetchBrands = async () => {
        if (!isEnabled) {
            toast.error("Lütfen önce Trendyol API ayarlarını kaydedin.");
            return;
        }
        setLoadingBrands(true);
        const res = await getTrendyolBrands();
        if (res.success) {
            setBrands(res.data);
            toast.success(`${res.data.length} marka çekildi.`);
        } else {
            toast.error(res.message);
        }
        setLoadingBrands(false);
    };

    const fetchCategories = async () => {
        if (!isEnabled) {
            toast.error("Lütfen önce Trendyol API ayarlarını kaydedin.");
            return;
        }
        setLoadingCategories(true);
        const res = await getTrendyolCategories();
        if (res.success) {
            setCategories(res.data);
            toast.success("Kategoriler çekildi.");
        } else {
            toast.error(res.message);
        }
        setLoadingCategories(false);
    };

    // Flatten nested categories for search
    const flattenCategories = (cats: any[]): any[] => {
        let flat: any[] = [];
        cats.forEach(c => {
            flat.push({ id: c.id, name: c.name, parentId: c.parentId });
            if (c.subCategories && c.subCategories.length > 0) {
                flat = [...flat, ...flattenCategories(c.subCategories)];
            }
        });
        return flat;
    };

    const filteredBrands = brands.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase()));

    // We only flatten if we have data
    const allCategories = categories.length > 0 ? flattenCategories(categories) : [];
    const filteredCategories = allCategories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()));

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Kopyalandı: " + text);
    };

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle>Trendyol Veri Rehberi</CardTitle>
                <CardDescription>
                    Eşleştirme yapmak için Trendyol'daki Marka ve Kategori ID'lerini buradan bulabilirsiniz.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!isEnabled && (
                    <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md mb-4 text-sm border border-yellow-200">
                        Bu alanı kullanmak için önce yukarıdan <strong>API Bilgilerini girip kaydedin</strong>.
                    </div>
                )}
                <Tabs defaultValue="brands">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="brands">Markalar</TabsTrigger>
                        <TabsTrigger value="categories">Kategoriler</TabsTrigger>
                    </TabsList>

                    {/* BRANDS TAB */}
                    <TabsContent value="brands" className="space-y-4">
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={fetchBrands} disabled={loadingBrands}>
                                {loadingBrands ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Trendyol Markalarını Listele
                            </Button>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Marka Ara... (Listeyi çektikten sonra kullanın)"
                                className="pl-8"
                                value={brandSearch}
                                onChange={(e) => setBrandSearch(e.target.value)}
                            />
                        </div>

                        <div className="border rounded-md h-64 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-900">
                            {brands.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center mt-10">Önce "Markaları Listele" butonuna basın.</p>
                            ) : (
                                filteredBrands.length === 0 ? <p className="text-sm text-gray-500">Sonuç bulunamadı.</p> :
                                    <ul className="space-y-1">
                                        {filteredBrands.slice(0, 100).map((brand) => (
                                            <li key={brand.id} className="flex justify-between items-center text-sm p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded group">
                                                <span>{brand.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">{brand.id}</span>
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => copyToClipboard(brand.id.toString())}>
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </li>
                                        ))}
                                        {filteredBrands.length > 100 && <li className="text-xs text-center p-2 text-gray-400">... ve {filteredBrands.length - 100} daha fazla</li>}
                                    </ul>
                            )}
                        </div>
                    </TabsContent>

                    {/* CATEGORIES TAB */}
                    <TabsContent value="categories" className="space-y-4">
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={fetchCategories} disabled={loadingCategories}>
                                {loadingCategories ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Trendyol Kategorilerini Listele
                            </Button>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Kategori Ara... (Listeyi çektikten sonra kullanın)"
                                className="pl-8"
                                value={categorySearch}
                                onChange={(e) => setCategorySearch(e.target.value)}
                            />
                        </div>

                        <div className="border rounded-md h-64 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-900">
                            {categories.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center mt-10">Önce "Kategorileri Listele" butonuna basın.</p>
                            ) : (
                                filteredCategories.length === 0 ? <p className="text-sm text-gray-500">Sonuç bulunamadı.</p> :
                                    <ul className="space-y-1">
                                        {filteredCategories.slice(0, 100).map((cat) => (
                                            <li key={cat.id} className="flex justify-between items-center text-sm p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded group">
                                                <span>{cat.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">{cat.id}</span>
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => copyToClipboard(cat.id.toString())}>
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </li>
                                        ))}
                                        {filteredCategories.length > 100 && <li className="text-xs text-center p-2 text-gray-400">... ve {filteredCategories.length - 100} daha fazla</li>}
                                    </ul>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
