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
}

export function CategorySection({ categories }: CategorySectionProps) {
    return (
        <section className="container mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 pl-4 border-l-4 border-[#17457C]">
                Kategoriler
            </h2>
            <div className="grid gap-3 sm:gap-6 grid-cols-2 lg:grid-cols-4">
                {categories.map((category) => (
                    <Link
                        key={category.id}
                        href={`/category/${category.slug}`}
                        className="group relative flex flex-col h-full bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                    >
                        {/* Image Area */}
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                            {category.imageUrl ? (
                                <Image
                                    src={category.imageUrl}
                                    alt={category.name}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                    <span className="text-4xl opacity-20">🚙</span>
                                </div>
                            )}
                        </div>

                        {/* Content Area */}
                        <div className="flex flex-col flex-1 p-4 text-center">
                            <h3 className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-[#17457C] transition-colors line-clamp-2 mb-2">
                                {category.name}
                            </h3>

                            <div className="mt-auto pt-2 flex items-center justify-center text-sm font-medium text-[#17457C] opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                                <span>İncele</span>
                                <ArrowRight className="h-3.5 w-3.5 ml-1" />
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
