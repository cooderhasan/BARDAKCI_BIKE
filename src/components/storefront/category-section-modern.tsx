import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

interface Category {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string | null;
}

interface CategorySectionProps {
    categories: Category[];
    row?: "top" | "bottom" | "all";
}

export function CategorySectionModern({ categories, row = "all" }: CategorySectionProps) {
    if (!categories || categories.length === 0) return null;

    const topRow = categories.slice(0, 2);
    const bottomRow = categories.slice(2, 5);

    return (
        <section className="container mx-auto px-4">
            <div className="space-y-10">
                {/* Top Row: 2 Large Cards */}
                {(row === "all" || row === "top") && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        {topRow.map((category) => (
                            <Link
                                key={category.id}
                                href={`/category/${category.slug}`}
                                className="group block"
                            >
                                <div className="relative h-64 sm:h-72 md:h-96 rounded-2xl overflow-hidden mb-4 ring-1 ring-black/5 dark:ring-white/10 group-hover:shadow-2xl transition-all duration-500 bg-black">
                                    {category.imageUrl ? (
                                        <Image
                                            src={category.imageUrl}
                                            alt={category.name}
                                            fill
                                            className="object-contain sm:object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                            sizes="(max-width: 640px) 100vw, 50vw"
                                            priority
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800" />
                                    )}
                                </div>
                                <div className="space-y-2 px-1">
                                    <h3 className="text-gray-900 dark:text-white font-black text-xl md:text-2xl group-hover:text-[#17457C] transition-colors">
                                        {category.name}
                                    </h3>
                                    <div className="flex items-center gap-2 text-[#17457C] font-bold">
                                        <span className="text-xs uppercase tracking-widest">Ürünleri İncele</span>
                                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-2" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Bottom Row: 3 Smaller Cards */}
                {(row === "all" || row === "bottom") && bottomRow.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                        {bottomRow.map((category, index) => (
                            <Link
                                key={category.id}
                                href={`/category/${category.slug}`}
                                className={`group block ${index === bottomRow.length - 1 ? 'hidden sm:block' : ''}`}
                            >
                                <div className="relative h-56 sm:h-64 md:h-72 rounded-2xl overflow-hidden mb-4 ring-1 ring-black/5 dark:ring-white/10 group-hover:shadow-xl transition-all duration-500 bg-black">
                                    {category.imageUrl ? (
                                        <Image
                                            src={category.imageUrl}
                                            alt={category.name}
                                            fill
                                            className="object-contain sm:object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                            sizes="(max-width: 640px) 100vw, 33vw"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800" />
                                    )}
                                </div>
                                <div className="space-y-1.5 px-1">
                                    <h3 className="text-gray-900 dark:text-white font-extrabold text-lg group-hover:text-[#17457C] transition-colors">
                                        {category.name}
                                    </h3>
                                    <div className="flex items-center gap-1.5 text-[#17457C] font-bold">
                                        <span className="text-[10px] uppercase tracking-widest">İncele</span>
                                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1.5" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
