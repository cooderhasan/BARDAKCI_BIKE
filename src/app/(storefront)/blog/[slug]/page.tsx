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

    // Get 4 featured products to showcase alongside the blog post
    const featuredProducts = await prisma.product.findMany({
        where: { isActive: true, isFeatured: true },
        take: 4,
        include: {
            _count: { select: { variants: true } }
        }
    });

    // Fallback if no featured products
    const displayProducts = featuredProducts.length > 0 
        ? featuredProducts 
        : await prisma.product.findMany({
            where: { isActive: true },
            take: 4,
            include: {
                _count: { select: { variants: true } }
            }
        });

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
