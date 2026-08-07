import { getPolicy } from "@/app/actions/policy";
import { getStoreType } from "@/lib/store-helper";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
    const activeStore = await getStoreType();
    const policy = await getPolicy("membership", activeStore);
    const title = policy?.title || "Üyelik Sözleşmesi";
    return {
        title,
        description: `${title}. Üyelik ve bayilik kullanım şartları hakkında detaylar.`,
        alternates: {
            canonical: "/policies/membership",
        },
    };
}

export default async function MembershipPage() {
    const activeStore = await getStoreType();
    const policy = await getPolicy("membership", activeStore);
    if (!policy) return notFound();

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
                {policy.title}
            </h1>
            <div
                className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: policy.content }}
            />
        </div>
    );
}
