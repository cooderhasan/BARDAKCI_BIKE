"use client";

import Link from "next/link";
import { ChevronRight, Menu, Car, Zap, Disc, Shield, Sparkles, Settings, Gauge, Wrench, Battery, Layers, Box } from "lucide-react";
import { cn } from "@/lib/utils";

interface Category {
    id: string;
    name: string;
    slug: string;
    children?: Category[];
    imageUrl?: string | null;
}

interface CategoryMenuProps {
    categories: Category[];
}

function getCategoryIcon(name: string) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("motor")) return <Gauge className="h-5 w-5" />;
    if (lowerName.includes("fren")) return <Disc className="h-5 w-5" />;
    if (lowerName.includes("elektrik") || lowerName.includes("ateşleme")) return <Zap className="h-5 w-5" />;
    if (lowerName.includes("kaporta") || lowerName.includes("karoseri")) return <Shield className="h-5 w-5" />;
    if (lowerName.includes("aksesuar")) return <Sparkles className="h-5 w-5" />;
    if (lowerName.includes("filtre") || lowerName.includes("yağ")) return <Layers className="h-5 w-5" />;
    if (lowerName.includes("soğutma") || lowerName.includes("radyatör")) return <Box className="h-5 w-5" />;
    if (lowerName.includes("kask") || lowerName.includes("mont") || lowerName.includes("eldiven") || lowerName.includes("koruma")) return <Shield className="h-5 w-5" />;
    if (lowerName.includes("şanzıman") || lowerName.includes("vites")) return <Settings className="h-5 w-5" />;

    return <Wrench className="h-5 w-5" />;
}

export function CategoryMenu({ categories }: CategoryMenuProps) {
    return (
        <div className="relative group z-50">
            {/* Trigger Button - Premium Gradient */}
            <button className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 text-white font-bold rounded-t-xl transition-all shadow-lg min-w-[280px]">
                <div className="p-1.5 bg-white/20 rounded-lg">
                    <Menu className="h-5 w-5 text-white" />
                </div>
                <span className="tracking-wide">KATEGORİLER</span>
            </button>

            {/* Dropdown Container */}
            <div className="absolute top-full left-0 w-[280px] bg-white dark:bg-gray-800 shadow-2xl border-x border-b border-gray-100 dark:border-gray-700 rounded-b-xl invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-300 transform origin-top group-hover:scale-100 scale-95">
                <div className="flex flex-col py-3">
                    {categories.map((category) => (
                        <div key={category.id} className="group/item relative px-2">
                            {/* Main Category Item */}
                            <Link
                                href={`/category/${category.slug}`}
                                className="flex items-center justify-between px-3 py-3 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-700 transition-all group-hover/item:shadow-sm"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 group-hover/item:bg-blue-100 group-hover/item:text-[#17457C] transition-colors">
                                        {getCategoryIcon(category.name)}
                                    </div>
                                    <span>{category.name}</span>
                                </div>
                                {category.children && category.children.length > 0 && (
                                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover/item:text-[#17457C] transition-transform group-hover/item:translate-x-0.5" />
                                )}
                            </Link>

                            {/* Subcategories Flyout */}
                            {category.children && category.children.length > 0 && (
                                <div className="absolute left-[98%] top-0 w-[650px] min-h-[400px] bg-white dark:bg-gray-800 shadow-2xl border border-gray-100 dark:border-gray-700 rounded-xl ml-2 p-6 invisible opacity-0 group-hover/item:visible group-hover/item:opacity-100 transition-all duration-300 z-50 bg-[url('/pattern.png')] bg-no-repeat bg-right-bottom bg-contain">
                                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                                        <div className="p-2 bg-blue-100 rounded-lg text-[#17457C]">
                                            {getCategoryIcon(category.name)}
                                        </div>
                                        <span className="text-lg font-bold text-gray-800 dark:text-white">{category.name}</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {category.children.map((child) => (
                                            <Link
                                                key={child.id}
                                                href={`/category/${child.slug}`}
                                                className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 group/sub transition-all border border-transparent hover:border-blue-100 hover:shadow-sm"
                                            >
                                                {/* Image Box */}
                                                <div className="w-14 h-14 bg-white dark:bg-gray-700 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-400 group-hover/sub:text-[#17457C] group-hover/sub:border-blue-200 border border-gray-200 dark:border-gray-600 p-1 transition-colors shadow-sm">
                                                    {child.imageUrl ? (
                                                        <img src={child.imageUrl} alt={child.name} className="w-full h-full object-contain" />
                                                    ) : (
                                                        <Box className="h-6 w-6 opacity-30" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-gray-800 dark:text-gray-100 group-hover/sub:text-blue-700 text-sm">
                                                        {child.name}
                                                    </span>
                                                    <span className="text-xs text-gray-400 mt-1 flex items-center group-hover/sub:text-blue-500">
                                                        Ürünleri İncele <ChevronRight className="h-3 w-3 ml-0.5" />
                                                    </span>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
