import { getPolicy } from "@/app/actions/policy";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";

export const metadata: Metadata = {
    title: "Gizlilik Politikası | Bardakcı Bike",
    description: "Bardakcı Bike gizlilik politikası. Kişisel verilerinizin güvenliği ve gizliliğinizle ilgili aldığımız önlemler hakkında bilgi edinin.",
    alternates: {
        canonical: `${BASE_URL}/policies/privacy`,
    },
};

export default async function PrivacyPage() {
    const policy = await getPolicy("privacy");
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
