import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWishlistItems } from "@/app/actions/wishlist";
import { ProductCard } from "@/components/storefront/product-card";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
    title: "Favorilerim | Bardakcı Bike",
    description: "Favori ürünleriniz.",
};

export default async function WishlistPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    // Fetch user discount rate
    let userDiscountRate = 0;
    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                discountGroup: {
                    select: { discountRate: true }
                }
            }
        });
        userDiscountRate = Number(user?.discountGroup?.discountRate || 0);
    } catch (error) {
        console.error("Error fetching user discount rate:", error);
    }

    const wishlistItems = await getWishlistItems();
    const isDealer = session.user.role === "DEALER";

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Favorilerim</h1>
                <span className="text-sm text-gray-500">
                    {wishlistItems.length} Ürün
                </span>
            </div>

            {wishlistItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                        <Package className="w-8 h-8 text-gray-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Listeniz Boş
                    </h2>
                    <p className="text-gray-500 max-w-sm mb-6">
                        Henüz favorilerinize ürün eklemediniz. Beğendiğiniz ürünleri kalp ikonuna tıklayarak listenize ekleyebilirsiniz.
                    </p>
                    <Button asChild>
                        <Link href="/products">Alışverişe Başla</Link>
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {wishlistItems.map((item) => (
                        <div key={item.product.id} className="h-[400px]">
                            <ProductCard
                                product={{
                                    ...item.product,
                                    listPrice: Number(item.product.listPrice),
                                    salePrice: item.product.salePrice ? Number(item.product.salePrice) : null,
                                    images: item.product.images || [],
                                    category: item.product.category || null,
                                    _count: item.product._count || { variants: 0 },
                                    weight: item.product.weight ? Number(item.product.weight) : null,
                                    width: item.product.width ? Number(item.product.width) : null,
                                    height: item.product.height ? Number(item.product.height) : null,
                                    length: item.product.length ? Number(item.product.length) : null,
                                    desi: item.product.desi ? Number(item.product.desi) : null,
                                }}
                                discountRate={userDiscountRate}
                                isDealer={isDealer}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
