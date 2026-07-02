import { prisma } from "@/lib/db";
import { BlogTable } from "@/components/admin/blog-table";

export const dynamic = 'force-dynamic';

export default async function BlogPage() {
    const posts = await prisma.blogPost.findMany({
        orderBy: { createdAt: "desc" },
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Blog Yönetimi
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Sitenizin blog yazılarını oluşturun ve AI yardımıyla yönetin
                </p>
            </div>

            <BlogTable posts={posts} />
        </div>
    );
}
