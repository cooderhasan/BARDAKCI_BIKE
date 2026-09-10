import { prisma } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Calendar, ChevronRight, Eye, ArrowLeft } from "lucide-react";
import { ProductCardModern } from "@/components/storefront/product-card-modern";
import { Metadata } from "next";
import { getStoreType, getStoreFilter } from "@/lib/store-helper";

interface PageProps {
    params: Promise<{
        slug: string;
    }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const post = await prisma.blogPost.findUnique({
        where: { slug, isActive: true },
        select: { title: true, summary: true, imageUrl: true }
    });

    if (!post) return { title: "Yazı Bulunamadı" };

    const description = post.summary || "Blog sayfamızda sektörel rehberler ve güncel yazılarımızı okuyun.";
    const imageUrl = post.imageUrl || "/img/og-default.jpg";

    return {
        title: post.title, // Root layout will automatically append " | storeTitle"
        description,
        alternates: {
            canonical: `/blog/${slug}`
        },
        openGraph: {
            title: post.title,
            description,
            url: `/blog/${slug}`,
            images: [{ url: imageUrl }],
            type: "article",
        }
    };
}

export const dynamic = 'force-dynamic';

export default async function StorefrontBlogPostDetailPage({ params }: PageProps) {
    const { slug } = await params;
    const activeStore = await getStoreType();
    const isMotor = activeStore === "MOTOR";
    const storeFilter = getStoreFilter(activeStore);

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
    // Let's analyze the blog post to find related products
    let displayProducts: any[] = [];

    // 0. Highest Priority: Explicitly selected manual products by the admin
    if (post.relatedProductIds && post.relatedProductIds.length > 0) {
        try {
            const manualProducts = await prisma.product.findMany({
                where: {
                    id: { in: post.relatedProductIds },
                    isActive: true,
                    store: storeFilter as any,
                },
                include: {
                    _count: { select: { variants: true } }
                }
            });

            // Preserve manual ordering set by admin
            displayProducts = post.relatedProductIds
                .map(id => manualProducts.find(p => p.id === id))
                .filter(Boolean) as any[];
        } catch (e) {
            console.error("Failed to fetch manual related products:", e);
        }
    }

    // If no manual products selected (or less than 4), find related products automatically
    if (displayProducts.length < 4) {
        try {
            const cleanSlug = slug.toLowerCase();
            const cleanTitle = (post.title || "").toLowerCase();
            const combinedText = `${cleanSlug.replace(/-/g, " ")} ${cleanTitle}`;
            const existingIds = displayProducts.map(p => p.id);

            // Is this blog post a bicycle buying / selection guide?
            const isBikeSelectionTopic = 
                combinedText.includes("secerken") ||
                combinedText.includes("seçerken") ||
                combinedText.includes("secimi") ||
                combinedText.includes("seçimi") ||
                combinedText.includes("nasil olmali") ||
                combinedText.includes("nasıl olmalı") ||
                combinedText.includes("karsilastirmasi") ||
                combinedText.includes("karşılaştırması") ||
                combinedText.includes("fren") ||
                combinedText.includes("yetiskin") ||
                combinedText.includes("yetişkin") ||
                combinedText.includes("kac yas") ||
                combinedText.includes("kaç yaş") ||
                combinedText.includes("bisikletler");

            const BICYCLE_MAIN_SLUGS = [
                "dag-bisikleti",
                "sehir-bisikleti",
                "yol-yaris-bisikleti",
                "katlanabilir-bisiklet",
                "elektrikli-bisiklet",
                "cocuk-bisikleti"
            ];

            const SPARE_PART_EXCLUDES = [
                "iç lastik", "ic lastik", "lastik", "yama", "sehpa", "sehba", "korna", "zil", "elcik",
                "etiket", "sticker", "vida", "pabuç", "pabuc", "fren teli", "debriyaj", "kablo",
                "zincir yağı", "branda", "makam bayrağı", "bayrak", "ön amblem", "baglantı", "kulak",
                "buji", "conta", "kılıf"
            ];

            // Strictly fetch active categories for the CURRENT store
            const categories = await prisma.category.findMany({
                where: {
                    isActive: true,
                    store: storeFilter as any,
                },
                include: {
                    children: {
                        where: { isActive: true, store: storeFilter as any },
                        select: { id: true, name: true, slug: true }
                    }
                }
            });

            // 1. Check for specific wheel/jant size (e.g. 16 jant, 20 jant, 24 jant, etc.)
            const jantSizeMatch = combinedText.match(/\b(12|14|16|18|20|24|26|27\.5|27,5|27-5|28|29)\s*(jant|inç|inch|")/i) 
                || cleanSlug.match(/(12|14|16|18|20|24|26|27-5|28|29)-jant/i);

            if (jantSizeMatch && displayProducts.length < 4) {
                const size = jantSizeMatch[1].replace(',', '.').replace('-5', '.5');

                // Find categories matching this specific jant size (e.g. 16-jant-erkek-cocuk-bisikleti)
                const matchingSizeCats = categories.filter(cat => 
                    cat.slug.includes(`${size.replace('.', '')}-jant`) || 
                    cat.slug.includes(`${size}-jant`) ||
                    cat.name.toLowerCase().includes(`${size} jant`)
                );

                if (matchingSizeCats.length > 0) {
                    const catIds = matchingSizeCats.map(c => c.id);
                    const sizeCatProducts = await prisma.product.findMany({
                        where: {
                            isActive: true,
                            store: storeFilter as any,
                            id: { notIn: existingIds },
                            OR: [
                                { categories: { some: { id: { in: catIds } } } },
                                { categoryId: { in: catIds } }
                            ]
                        },
                        orderBy: [{ stock: 'desc' }, { isFeatured: 'desc' }, { createdAt: 'desc' }],
                        take: 4 - displayProducts.length,
                        include: {
                            _count: { select: { variants: true } }
                        }
                    });
                    displayProducts = [...displayProducts, ...sizeCatProducts];
                }
            }

            // 2. Specific intent / accessory keywords (ONLY if the post is explicitly about that accessory, NOT a general bike buying guide)
            if (displayProducts.length < 4 && !isBikeSelectionTopic) {
                const specificKeywordMap: { [key: string]: string[] } = {
                    "denge": ["denge"],
                    "kask": ["kask"],
                    "eldiven": ["eldiven"],
                    "lastik": ["lastik"],
                    "aksesuar": ["aksesuar"],
                    "pedal": ["pedal"],
                    "sele": ["sele"],
                    "kilit": ["kilit"],
                    "pompa": ["pompa"]
                };

                const matchedKws = Object.keys(specificKeywordMap).filter(kw => combinedText.includes(kw));
                if (matchedKws.length > 0) {
                    const currentIds = displayProducts.map(p => p.id);
                    const searchTerms = matchedKws.flatMap(kw => specificKeywordMap[kw]);
                    
                    const kwProducts = await prisma.product.findMany({
                        where: {
                            isActive: true,
                            store: storeFilter as any,
                            id: { notIn: currentIds },
                            OR: searchTerms.map(term => ({
                                name: {
                                    contains: term,
                                    mode: 'insensitive'
                                }
                            }))
                        },
                        orderBy: [{ stock: 'desc' }, { isFeatured: 'desc' }, { createdAt: 'desc' }],
                        take: 4 - displayProducts.length,
                        include: {
                            _count: { select: { variants: true } }
                        }
                    });
                    displayProducts = [...displayProducts, ...kwProducts];
                }
            }

            // 3. Category Mapping via smart topics (cocuk, dag, yol, sehir, elektrikli, katlanir)
            if (displayProducts.length < 4) {
                const categoryKeywordMap = [
                    { categorySlugs: ["cocuk-bisikleti", "cocuk-bisikletleri"], keywords: ["cocuk", "çocuk", "bebek", "cocug", "denge", "yas", "yaş"] },
                    { categorySlugs: ["dag-bisikleti", "dag-bisikletleri"], keywords: ["dag", "dağ", "mtb", "rockrider", "arazi"] },
                    { categorySlugs: ["yol-yaris-bisikleti"], keywords: ["yol", "yaris", "yarış", "gravel", "yaris-bisikleti"] },
                    { categorySlugs: ["katlanabilir-bisiklet"], keywords: ["katlanir", "katlanır", "katlanabilir"] },
                    { categorySlugs: ["sehir-bisikleti"], keywords: ["sehir", "şehir", "tur", "trekking"] },
                    { categorySlugs: ["elektrikli-bisiklet"], keywords: ["elektrikli", "ebike", "e-bike"] }
                ];

                let matchedCatIds: string[] = [];
                for (const mapping of categoryKeywordMap) {
                    const hasMatch = mapping.keywords.some(kw => combinedText.includes(kw));
                    if (hasMatch) {
                        const found = categories.filter(c => mapping.categorySlugs.some(cs => c.slug.includes(cs)));
                        if (found.length > 0) {
                            found.forEach(cat => {
                                matchedCatIds.push(cat.id);
                                cat.children?.forEach(ch => matchedCatIds.push(ch.id));
                            });
                            break;
                        }
                    }
                }

                // If general bike selection and no specific category matched, include all 6 real bicycle categories
                if (matchedCatIds.length === 0 && isBikeSelectionTopic) {
                    const mainBikeCats = categories.filter(c => BICYCLE_MAIN_SLUGS.includes(c.slug));
                    mainBikeCats.forEach(cat => {
                        matchedCatIds.push(cat.id);
                        cat.children?.forEach(ch => matchedCatIds.push(ch.id));
                    });
                }

                if (matchedCatIds.length > 0) {
                    const currentIds = displayProducts.map(p => p.id);
                    const catProducts = await prisma.product.findMany({
                        where: { 
                            isActive: true,
                            store: storeFilter as any,
                            id: { notIn: currentIds },
                            OR: [
                                { categories: { some: { id: { in: matchedCatIds } } } },
                                { categoryId: { in: matchedCatIds } }
                            ]
                        },
                        orderBy: [{ stock: 'desc' }, { isFeatured: 'desc' }, { createdAt: 'desc' }],
                        take: 4 - displayProducts.length,
                        include: {
                            _count: { select: { variants: true } }
                        }
                    });
                    displayProducts = [...displayProducts, ...catProducts];
                }
            }

            // 4. Fallback search by general terms in product names (excluding spare parts for bike topics)
            if (displayProducts.length < 4) {
                const currentIds = displayProducts.map(p => p.id);
                const fallbackProducts = await prisma.product.findMany({
                    where: {
                        isActive: true,
                        store: storeFilter as any,
                        id: { notIn: currentIds },
                        ...(isBikeSelectionTopic ? {
                            NOT: SPARE_PART_EXCLUDES.map(word => ({
                                name: { contains: word, mode: 'insensitive' as any }
                            }))
                        } : {})
                    },
                    orderBy: [{ isFeatured: 'desc' }, { stock: 'desc' }, { createdAt: 'desc' }],
                    take: 4 - displayProducts.length,
                    include: {
                        _count: { select: { variants: true } }
                    }
                });
                displayProducts = [...displayProducts, ...fallbackProducts];
            }
        } catch (err) {
            console.error("Error finding semantic recommended products:", err);
        }
    }

    // 5. Final fallback to featured or latest products from the CURRENT store
    if (displayProducts.length === 0) {
        const featuredProducts = await prisma.product.findMany({
            where: { isActive: true, store: storeFilter as any, isFeatured: true },
            orderBy: [{ stock: 'desc' }, { createdAt: 'desc' }],
            take: 4,
            include: {
                _count: { select: { variants: true } }
            }
        });

        displayProducts = featuredProducts.length > 0 
            ? featuredProducts 
            : await prisma.product.findMany({
                where: { isActive: true, store: storeFilter as any },
                orderBy: [{ stock: 'desc' }, { createdAt: 'desc' }],
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
                        <div className={`bg-gradient-to-br ${isMotor ? 'from-red-600/5 to-amber-500/5 dark:from-red-600/10 dark:to-amber-500/10 border-red-100/50 dark:border-red-900/30' : 'from-[#17457C]/5 to-blue-500/5 dark:from-[#17457C]/10 dark:to-blue-500/10 border-blue-100/50 dark:border-blue-900/30'} rounded-3xl p-6 border text-center`}>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                {isMotor ? "Motovitrin" : "Bardakcı Bisiklet"}
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4">
                                {isMotor
                                    ? "Motosikletiniz için kaliteli yedek parça ve aksesuarlar en uygun fiyatlarla mağazamızda ve web sitemizde."
                                    : "Hayalinizdeki bisiklete kavuşmanız ve en doğru sürüş keyfini yaşamanız için Konya'daki mağazamızda ve web sitemizde hizmetinizdeyiz."
                                }
                            </p>
                            <Link 
                                href="/products"
                                className={`inline-flex w-full items-center justify-center px-4 py-2.5 ${isMotor ? 'bg-red-600 hover:bg-red-700' : 'bg-[#17457C] hover:bg-blue-800'} text-white rounded-xl text-sm font-semibold transition-colors shadow-xs`}
                            >
                                {isMotor ? "Ürünleri İncele" : "Bisikletleri İncele"}
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
