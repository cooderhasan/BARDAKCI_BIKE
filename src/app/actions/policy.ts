'use server'

import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { ActiveStore, getStoreType } from "@/lib/store-helper"
import { adaptTextForStore, getDefaultPolicy } from "@/lib/default-policies"

export async function getPolicy(slug: string, storeTypeOverride?: ActiveStore) {
    const storeType = storeTypeOverride || (await getStoreType());

    // 1. Try store-specific slug first (e.g. privacy-motor)
    let policy = null;
    if (storeType === "MOTOR") {
        policy = await prisma.policy.findUnique({
            where: { slug: `${slug}-motor` },
        });
    }

    // 2. Try base slug (e.g. privacy)
    if (!policy) {
        policy = await prisma.policy.findUnique({
            where: { slug },
        });
    }

    // 3. If policy exists in DB, adapt content for active store
    if (policy) {
        return {
            ...policy,
            title: adaptTextForStore(policy.title, storeType),
            content: adaptTextForStore(policy.content, storeType),
        };
    }

    // 4. If policy not in DB, return rich default policy template
    return getDefaultPolicy(slug, storeType);
}

export async function updatePolicy(slug: string, title: string, content: string) {
    try {
        await prisma.policy.upsert({
            where: { slug },
            update: { title, content },
            create: { slug, title, content },
        })

        revalidatePath(`/policies/${slug}`)
        revalidatePath("/admin/policies")

        return { success: true }
    } catch (error) {
        console.error("Policy update error:", error)
        return { success: false, error: "Güncelleme başarısız oldu" }
    }
}

export async function getAllPolicies(storeTypeOverride?: ActiveStore) {
    const storeType = storeTypeOverride || (await getStoreType());
    try {
        const policies = await prisma.policy.findMany({
            orderBy: { title: "asc" },
        });

        if (policies.length > 0) {
            return policies.map((p) => ({
                ...p,
                title: adaptTextForStore(p.title, storeType),
                content: adaptTextForStore(p.content, storeType),
            }));
        }

        // Return list of default policies if DB is empty
        const defaultSlugs = [
            "privacy",
            "kvkk",
            "distance-sales",
            "cookies",
            "payment-methods",
            "cancellation",
            "commercial-communication",
            "membership",
        ];
        return defaultSlugs
            .map((slug) => getDefaultPolicy(slug, storeType))
            .filter((p): p is NonNullable<typeof p> => p !== null);
    } catch (error) {
        console.warn("Could not fetch policies, returning default array.", error);
        const defaultSlugs = ["privacy", "kvkk", "distance-sales", "cookies", "payment-methods", "cancellation"];
        return defaultSlugs
            .map((slug) => getDefaultPolicy(slug, storeType))
            .filter((p): p is NonNullable<typeof p> => p !== null);
    }
}

export async function deletePolicy(slug: string) {
    try {
        await prisma.policy.delete({
            where: { slug },
        })

        revalidatePath("/admin/policies")
        revalidatePath(`/policies/${slug}`)

        return { success: true }
    } catch (error) {
        console.error("Policy delete error:", error)
        return { success: false, error: "Silme işlemi başarısız oldu" }
    }
}
