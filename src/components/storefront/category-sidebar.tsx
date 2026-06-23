"use client";

import Link from "next/link";
import { Plus, Minus, ChevronRight } from "lucide-react";
import { useState } from "react";

interface Category {
    id: string;
    name: string;
    slug: string;
    children?: Category[];
    imageUrl?: string | null;
}

interface CategorySidebarProps {
    categories: Category[];
}

export function CategorySidebar({ categories }: CategorySidebarProps) {
    const [openCategories, setOpenCategories] = useState<string[]>([]);

    const toggleCategory = (categoryId: string) => {
        setOpenCategories((prev) =>
            prev.includes(categoryId)
                ? prev.filter((id) => id !== categoryId)
                : [...prev, categoryId]
        );
    };

    return (
        <div className="w-full bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#17457C] to-[#0f3460] text-white px-5 py-4 rounded-t-xl">
                <span className="font-bold text-base tracking-widest uppercase">Kategoriler</span>
            </div>

            {/* Category List - Accordion Style */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {categories.map((category) => {
                    const isOpen = openCategories.includes(category.id);
                    const hasChildren = category.children && category.children.length > 0;

                    return (
                        <div key={category.id}>
                            {/* Main Category Row */}
                            <div className="flex items-center">
                                <Link
                                    href={`/category/${category.slug}`}
                                    className="flex-1 px-5 py-3.5 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:text-[#17457C] hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                >
                                    {category.name}
                                </Link>
                                {hasChildren && (
                                    <button
                                        onClick={() => toggleCategory(category.id)}
                                        className="px-4 py-3 text-gray-400 hover:text-[#17457C] transition-colors"
                                        aria-label={isOpen ? "Kapat" : "Aç"}
                                    >
                                        {isOpen ? (
                                            <Minus className="h-4 w-4" />
                                        ) : (
                                            <Plus className="h-4 w-4" />
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Subcategories - Accordion Content */}
                            {hasChildren && isOpen && (
                                <div className="bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800">
                                    {category.children!.map((child) => (
                                        <Link
                                            key={child.id}
                                            href={`/category/${child.slug}`}
                                            className="flex items-center gap-2 px-5 py-2.5 pl-8 text-[13px] font-medium text-gray-600 dark:text-gray-300 hover:text-[#17457C] hover:bg-gray-100/50 dark:hover:bg-gray-700/30 transition-colors"
                                        >
                                            <ChevronRight className="h-3 w-3 text-gray-400" />
                                            {child.name}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Bottom - Subtle Branding */}
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 mt-auto">
                <p className="text-xs text-gray-500 dark:text-gray-500 font-semibold text-center uppercase tracking-wider">
                    Maceraya Hazır Bisiklet Modelleri
                </p>
            </div>
        </div>
    );
}
