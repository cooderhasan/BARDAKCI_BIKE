import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

interface Category {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string | null;
    productCount?: number;
}

// "DAĞ BİSİKLETİ" -> "Dağ Bisikleti" (Türkçe kurallarıyla)
const titleTr = (t: string) =>
    t.toLocaleLowerCase("tr-TR").replace(/(?:^|[\s-/])\S/g, (m) => m.toLocaleUpperCase("tr-TR"));

/** Görselin altı: ad + ürün sayısı solda, yuvarlak ok sağda (önceden büyük harfli kalın ad + "Ürünleri İncele") */
function CategoryCaption({ category, large }: { category: Category; large?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-3 px-1">
            <div className="min-w-0">
                <h3
                    className={`font-bold tracking-tight text-gray-900 dark:text-white group-hover:text-[#17457C] dark:group-hover:text-blue-300 transition-colors truncate ${large ? "text-lg md:text-xl" : "text-base md:text-lg"}`}
                >
                    {titleTr(category.name)}
                </h3>
                {typeof category.productCount === "number" && category.productCount > 0 && (
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-0.5">{category.productCount} ürün</p>
                )}
            </div>
            <span
                className={`shrink-0 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-[#17457C] dark:text-blue-300 group-hover:bg-[#17457C] group-hover:text-white group-hover:border-[#17457C] transition-all duration-300 ${large ? "w-10 h-10 md:w-11 md:h-11" : "w-9 h-9 md:w-10 md:h-10"}`}
            >
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </span>
        </div>
    );
}

interface CategorySectionProps {
    categories: Category[];
    row?: "top" | "bottom" | "all";
}

export function CategorySectionModern({ categories, row = "all" }: CategorySectionProps) {
    if (!categories || categories.length === 0) return null;

    // Kartlar sabit 3:2 oranında (admin'de önerilen ölçü 1200x800). Eskiden sabit yükseklikti; oran ekran genişliğine
    // göre değiştiği için hangi ölçüde görsel hazırlanacağı belli değildi ve görseller farklı yerlerden kırpılıyordu.
    const topRow = categories.slice(0, 2);
    const bottomRow = categories.slice(2, 5);

    return (
        // Sayfa zaten container + px-4 içinde (burada tekrar container/px-4 telefonda kenar boşluğunu ikiye katlıyordu)
        <section>
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
                                <div className="relative aspect-[3/2] rounded-2xl overflow-hidden mb-4 ring-1 ring-black/5 dark:ring-white/10 group-hover:shadow-2xl transition-all duration-500">
                                    {category.imageUrl ? (
                                        <Image
                                            src={category.imageUrl}
                                            alt={category.name}
                                            fill
                                            className="object-cover object-left transition-transform duration-700 ease-out group-hover:scale-105"
                                            sizes="(max-width: 640px) 100vw, 50vw"
                                            priority
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800" />
                                    )}
                                </div>
                                <CategoryCaption category={category} large />
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
                                <div className="relative aspect-[3/2] rounded-2xl overflow-hidden mb-4 ring-1 ring-black/5 dark:ring-white/10 group-hover:shadow-xl transition-all duration-500">
                                    {category.imageUrl ? (
                                        <Image
                                            src={category.imageUrl}
                                            alt={category.name}
                                            fill
                                            className="object-cover object-left transition-transform duration-700 ease-out group-hover:scale-105"
                                            sizes="(max-width: 640px) 100vw, 33vw"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800" />
                                    )}
                                </div>
                                <CategoryCaption category={category} />
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
