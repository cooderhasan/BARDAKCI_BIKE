import { getPolicy } from "@/app/actions/policy";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";

export const metadata: Metadata = {
    title: "KVKK Aydınlatma Metni",
    description: "KVKK (Kişisel Verilerin Korunması Kanunu) aydınlatma metni. Kişisel verilerinizin nasıl işlendiği ve haklarınız hakkında bilgi edinin.",
    alternates: {
        canonical: "/policies/kvkk",
    },
};

export default async function KvkkPage() {
    const policy = await getPolicy("kvkk");
    if (!policy) return notFound();

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
                {policy.title}
            </h1>
            <div
                className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-300"
                dangerouslySetInnerHTML={{ __html: policy.content }}
            />
        </div>
    );
}
