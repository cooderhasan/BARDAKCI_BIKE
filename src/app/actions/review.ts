"use server";
import { requireAdmin } from "@/lib/admin-guard";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function submitReview(productId: string, rating: number, comment: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Giriş yapmalısınız." };
    }

    if (rating < 1 || rating > 5) {
        return { success: false, error: "Geçersiz puanlama." };
    }

    try {
        // Check if user already reviewed this product
        const existingReview = await prisma.review.findFirst({
            where: {
                userId: session.user.id,
                productId: productId,
            },
        });

        if (existingReview) {
            return { success: false, error: "Bu ürünü daha önce değerlendirdiniz." };
        }

        await prisma.review.create({
            data: {
                userId: session.user.id,
                productId: productId,
                rating: rating,
                comment: comment,
                status: "PENDING", // Reviews need approval
            },
        });

        revalidatePath(`/products/[slug]`, 'page');
        return { success: true };
    } catch (error) {
        console.error("Submit review error:", error);
        return { success: false, error: "Bir hata oluştu." };
    }
}

export async function getProductReviews(productId: string) {
    const reviews = await prisma.review.findMany({
        where: {
            productId: productId,
            status: "APPROVED",
        },
        include: {
            user: {
                select: {
                    companyName: true,
                    email: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    return reviews;
}

export async function getReviewStats(productId: string) {
    const aggregations = await prisma.review.aggregate({
        where: {
            productId: productId,
            status: "APPROVED",
        },
        _avg: {
            rating: true,
        },
        _count: {
            rating: true,
        },
    });

    return {
        averageRating: aggregations._avg.rating || 0,
        totalReviews: aggregations._count.rating || 0,
    };
}

export async function getAdminReviews(status?: "PENDING" | "APPROVED" | "REJECTED") {
    await requireAdmin();
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
        throw new Error("Unauthorized");
    }

    return await prisma.review.findMany({
        where: status ? { status } : {},
        include: {
            user: {
                select: {
                    companyName: true,
                    email: true,
                }
            },
            product: {
                select: {
                    name: true,
                    slug: true,
                    images: true,
                }
            }
        },
        orderBy: {
            createdAt: "desc",
        },
    });
}

export async function updateReviewStatus(reviewId: string, status: "APPROVED" | "REJECTED") {
    await requireAdmin();
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
        return { success: false, error: "Unauthorized" };
    }

    try {
        await prisma.review.update({
            where: { id: reviewId },
            data: { status },
        });
        revalidatePath("/admin/reviews");
        revalidatePath("/products"); // Revalidate products to show/hide reviews
        return { success: true };
    } catch (error) {
        console.error("Update review status error:", error);
        return { success: false, error: "Bir hata oluştu." };
    }
}
