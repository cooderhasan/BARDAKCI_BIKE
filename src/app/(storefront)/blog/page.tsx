import { prisma } from "@/lib/db";
import Link from "next/link";
import Image from "next/image";
import { Clock, Calendar, ChevronRight } from "lucide-react";
import { Metadata } from "next";
import { getStoreType } from "@/lib/store-helper";

export const metadata: Metadata = {
    title: 'Rehberler ve Blog Yazıları',
    description: 'Seçim rehberleri, bakım ipuçları, teknik incelemeler ve sektörel blog yazılarımızı keşfedin.',
};

export const dynamic = 'force-dynamic';

export default async function StorefrontBlogPage() {
    const posts = await prisma.blogPost.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
    });

    const activeStore = await getStoreType();
    const isMotor = activeStore === "MOTOR";

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 py-12">
            <div className="container mx-auto px-4 max-w-6xl">
                {/* Header */}
                <div className="text-center max-w-2xl mx-auto mb-16 animate-in fade-in slide-in-from-top-4 duration-500">
                    <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight mb-4">
                        {isMotor ? "Motosiklet Kültürü & " : "Bisiklet Kültürü & "}<span className="text-[#17457C]">{isMotor ? "Motovitrin" : "Rehberler"}</span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed">
                        {isMotor 
                            ? "Motosiklet seçimi, bakımı, teknik özellikleri ve güvenli sürüşe dair bilmeniz gereken her şey bu rehberlerde!"
                            : "Bisiklet seçimi, bakımı, teknik özellikleri ve güvenli sürüşe dair bilmeniz gereken her şey bu rehberlerde!"}
                    </p>
                    <div className="w-16 h-1 bg-[#17457C] mx-auto mt-6 rounded-full" />
                </div>

                {/* Posts Grid */}
                {posts.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 shadow-sm">
                        <p className="text-gray-500 text-lg">Yakında yeni blog yazılarımız burada yayınlanacaktır.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {posts.map((post, index) => (
                            <article 
                                key={post.id} 
                                className="group bg-white dark:bg-gray-900 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-800 hover:border-blue-100 dark:hover:border-blue-900/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4"
                                style={{ animationDelay: `${index * 75}ms` }}
                            >
                                {/* Thumbnail Image */}
                                <Link href={`/blog/${post.slug}`} className="relative block aspect-[16/10] w-full overflow-hidden bg-gray-50 dark:bg-gray-950">
                                    {post.imageUrl ? (
                                        <img 
                                            src={post.imageUrl} 
                                            alt={post.title}
                                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-850 text-gray-400 font-medium text-sm">
                                            {isMotor ? "Motovitrin" : "Bardakcı Bike"}
                                        </div>
                                    )}
                                    <div className="absolute top-4 left-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xs px-3 py-1 rounded-full text-xs font-semibold text-[#17457C] flex items-center gap-1.5 shadow-sm">
                                        <Clock className="w-3.5 h-3.5" />
                                        {post.readTime} Dk Okuma
                                    </div>
                                </Link>

                                {/* Body */}
                                <div className="p-6 flex flex-col flex-1">
                                    {/* Date */}
                                    <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mb-3">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {new Date(post.createdAt).toLocaleDateString("tr-TR", {
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric",
                                        })}
                                    </div>

                                    {/* Title */}
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-[#17457C] transition-colors leading-snug line-clamp-2">
                                        <Link href={`/blog/${post.slug}`}>
                                            {post.title}
                                        </Link>
                                    </h2>

                                    {/* Summary */}
                                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6 line-clamp-3">
                                        {post.summary || "Bu yazımızın detaylarını incelemek için tıklayın."}
                                    </p>

                                    {/* Footer / Read More */}
                                    <div className="mt-auto pt-4 border-t border-gray-50 dark:border-gray-800">
                                        <Link 
                                            href={`/blog/${post.slug}`}
                                            className="inline-flex items-center text-sm font-semibold text-[#17457C] hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors group/link"
                                        >
                                            Yazıyı Oku
                                            <ChevronRight className="w-4 h-4 ml-1 group-hover/link:translate-x-0.5 transition-transform" />
                                        </Link>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
