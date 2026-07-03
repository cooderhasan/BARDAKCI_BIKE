import { prisma } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Calendar, ChevronRight, Eye, ArrowLeft } from "lucide-react";
import { ProductCardModern } from "@/components/storefront/product-card-modern";

interface PageProps {
    params: Promise<{
        slug: string;
    }>;
}

export const dynamic = 'force-dynamic';

export default async function StorefrontBlogPostDetailPage({ params }: PageProps) {
    const { slug } = await params;

    const post = await prisma.blogPost.findUnique({
        where: { slug },
    });

    if (!post || !post.isActive) {
        notFound();
    }

    // Increment view count asynchronously/safely
    try {
        await prisma.blogPost.update({
            where: { id: post.id },
            data: { viewCount: { increment: 1 } },
        });
    } catch (e) {
        console.error("Failed to increment blog view count:", e);
    }

    // Let's analyze the blog post title/slug to find related products semantically
    let displayProducts: any[] = [];

    try {
        const cleanSlug = slug.toLowerCase();
        const slugWords = cleanSlug.split("-");
        
        const categories = await prisma.category.findMany({
            where: { isActive: true }
        });

        // 1. Highly specific keywords check first (e.g. denge, kask, eldiven)
        const specificKeywordMap: { [key: string]: string[] } = {
            "denge": ["denge"],
            "kask": ["kask"],
            "eldiven": ["eldiven"],
            "lastik": ["lastik"],
            "aksesuar": ["aksesuar"]
        };

        const matchedSpecificKeywords = Object.keys(specificKeywordMap).filter(kw => 
            slugWords.some(word => word.startsWith(kw))
        );

        if (matchedSpecificKeywords.length > 0) {
            const searchTerms = matchedSpecificKeywords.flatMap(kw => specificKeywordMap[kw]);
            
            displayProducts = await prisma.product.findMany({
                where: {
                    isActive: true,
                    OR: searchTerms.map(term => ({
                        name: {
                            contains: term,
                            mode: 'insensitive'
                        }
                    }))
                },
                take: 4,
                include: {
                    _count: { select: { variants: true } }
                }
            });
        }

        // 2. If no specific products found, try Category matching
        if (displayProducts.length === 0) {
            let matchedCategory = null;

            // Smart Category Mapping via keywords in slug words (for standard categories)
            const categoryKeywordMap = [
                { categorySlug: "denge-bisikleti", keywords: ["denge"] },
                { categorySlug: "denge-bisikletleri", keywords: ["denge"] },
                { categorySlug: "cocuk-bisikleti", keywords: ["cocuk", "cocug"] },
                { categorySlug: "dag-bisikleti", keywords: ["dag", "rockrider"] },
                { categorySlug: "yol-yaris-bisikleti", keywords: ["yol", "yaris", "gravel"] },
                { categorySlug: "katlanabilir-bisiklet", keywords: ["katlanir", "katlanabilir"] },
                { categorySlug: "sehir-bisikleti", keywords: ["sehir", "tur"] },
                { categorySlug: "elektrikli-bisiklet", keywords: ["elektrikli", "ebike"] }
            ];

            for (const mapping of categoryKeywordMap) {
                const hasMatch = slugWords.some(word => 
                    mapping.keywords.some(kw => word.startsWith(kw))
                );
                if (hasMatch) {
                    matchedCategory = categories.find(cat => cat.slug === mapping.categorySlug);
                    if (matchedCategory) {
                        break;
                    }
                }
            }

            // Fallback to original category matching if no smart category match was found
            if (!matchedCategory) {
                const sortedCategories = [...categories].sort((a, b) => b.name.length - a.name.length);
                for (const cat of sortedCategories) {
                    const catNameLower = cat.name.toLowerCase();
                    const cleanCatName = catNameLower.replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');
                    if (cleanSlug.includes(cat.slug) || cleanSlug.includes(cleanCatName)) {
                        matchedCategory = cat;
                        break;
                    }
                }
            }

            if (matchedCategory) {
                // Find direct active subcategories of the matched category
                const subcategories = await prisma.category.findMany({
                    where: {
                        isActive: true,
                        parentId: matchedCategory.id
                    },
                    select: { id: true }
                });
                const categoryIds = [matchedCategory.id, ...subcategories.map(c => c.id)];

                displayProducts = await prisma.product.findMany({
                    where: { 
                        isActive: true,
                        OR: [
                            { categories: { some: { id: { in: categoryIds } } } },
                            { categoryId: { in: categoryIds } }
                        ]
                    },
                    take: 4,
                    include: {
                        _count: { select: { variants: true } }
                    }
                });
            }
        }

        // 3. Fallback to general keyword search on product names if still empty
        if (displayProducts.length === 0) {
            const generalKeywordMap: { [key: string]: string[] } = {
                "cocuk": ["cocuk", "çocuk"],
                "yol": ["yol"],
                "dag": ["dag", "dağ"],
                "katlanir": ["katlanir", "katlanır", "katlanabilir"],
                "elektrikli": ["elektrikli"],
                "sehir": ["sehir", "şehir"]
            };

            const keywords = Object.keys(generalKeywordMap);
            const matchedKeywords = keywords.filter(kw => {
                if (kw === "yol") {
                    return slugWords.includes("yol"); // Standalone only
                }
                return slugWords.some(word => word.startsWith(kw) || (kw === "cocuk" && word.startsWith("cocug")));
            });

            if (matchedKeywords.length > 0) {
                const searchTerms = matchedKeywords.flatMap(kw => generalKeywordMap[kw]);

                displayProducts = await prisma.product.findMany({
                    where: {
                        isActive: true,
                        OR: searchTerms.map(term => ({
                            name: {
                                contains: term,
                                mode: 'insensitive'
                            }
                        }))
                    },
                    take: 4,
                    include: {
                        _count: { select: { variants: true } }
                    }
                });
            }
        }
    } catch (err) {
        console.error("Error finding semantic recommended products:", err);
    }

    // 4. Fallback to featured or latest products if no semantic products found
    if (displayProducts.length === 0) {
        const featuredProducts = await prisma.product.findMany({
            where: { isActive: true, isFeatured: true },
            take: 4,
            include: {
                _count: { select: { variants: true } }
            }
        });

        displayProducts = featuredProducts.length > 0 
            ? featuredProducts 
            : await prisma.product.findMany({
                where: { isActive: true },
                take: 4,
                include: {
                    _count: { select: { variants: true } }
                }
            });
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 py-8">
            <div className="container mx-auto px-4 max-w-6xl animate-in fade-in duration-500">
                
                {/* Breadcrumbs */}
                <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-8 overflow-x-auto whitespace-nowrap">
                    <Link href="/" className="hover:text-[#17457C] transition-colors">
                        Ana Sayfa
                    </Link>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    <Link href="/blog" className="hover:text-[#17457C] transition-colors">
                        Blog
                    </Link>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    <span className="text-gray-900 dark:text-white font-medium max-w-[200px] sm:max-w-xs truncate">
                        {post.title}
                    </span>
                </nav>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                    
                    {/* Main Content Area */}
                    <main className="lg:col-span-8 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 sm:p-10 shadow-sm">
                        
                        {/* Back to Blog */}
                        <Link 
                            href="/blog" 
                            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#17457C] transition-colors mb-6 group"
                        >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                            Tüm Yazılara Dön
                        </Link>

                        {/* Title */}
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-6 leading-tight">
                            {post.title}
                        </h1>

                        {/* Meta Infos */}
                        <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-8 pb-6 border-b border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                {new Date(post.createdAt).toLocaleDateString("tr-TR", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                })}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-gray-400" />
                                {post.readTime} Dk Okuma
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Eye className="w-4 h-4 text-gray-400" />
                                {post.viewCount + 1} Okunma
                            </div>
                        </div>

                        {/* Banner Image */}
                        {post.imageUrl && (
                            <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden mb-8 bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800">
                                <img 
                                    src={post.imageUrl} 
                                    alt={post.title} 
                                    className="object-cover w-full h-full"
                                />
                            </div>
                        )}

                        {/* HTML Article Content */}
                        <div 
                            className="prose prose-blue dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed text-base sm:text-lg"
                            dangerouslySetInnerHTML={{ __html: post.content }}
                        />

                    </main>

                    {/* Sidebar / Recommended Products */}
                    <aside className="lg:col-span-4 space-y-8">
                        
                        {/* Company Card / CTA */}
                        <div className="bg-gradient-to-br from-[#17457C]/5 to-blue-500/5 dark:from-[#17457C]/10 dark:to-blue-500/10 rounded-3xl p-6 border border-blue-100/50 dark:border-blue-900/30 text-center">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                Bardakcı Bisiklet
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4">
                                Hayalinizdeki bisiklete kavuşmanız ve en doğru sürüş keyfini yaşamanız için Konya'daki mağazamızda ve web sitemizde hizmetinizdeyiz.
                            </p>
                            <Link 
                                href="/products"
                                className="inline-flex w-full items-center justify-center px-4 py-2.5 bg-[#17457C] text-white rounded-xl text-sm font-semibold hover:bg-blue-800 transition-colors shadow-xs"
                            >
                                Bisikletleri İncele
                            </Link>
                        </div>

                        {/* Recommended Products List */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white pl-1">
                                Önerilen Ürünler
                            </h3>
                            
                            <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                                {displayProducts.map((product) => (
                                    <div key={product.id} className="lg:max-w-xs mx-auto w-full">
                                        <ProductCardModern
                                            product={{
                                                ...product,
                                                listPrice: Number(product.listPrice),
                                                salePrice: product.salePrice ? Number(product.salePrice) : null,
                                                weight: product.weight ? Number(product.weight) : null,
                                                width: product.width ? Number(product.width) : null,
                                                height: product.height ? Number(product.height) : null,
                                                length: product.length ? Number(product.length) : null,
                                                desi: product.desi ? Number(product.desi) : null,
                                                googlePrice: (product as any).googlePrice ? Number((product as any).googlePrice) : null,
                                            }}
                                            discountRate={null}
                                            isDealer={false}
                                            priority={false}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                    </aside>

                </div>

            </div>
        </div>
    );
}
