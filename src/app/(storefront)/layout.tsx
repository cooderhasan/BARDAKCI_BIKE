import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StorefrontHeader } from "@/components/storefront/header";
import { StorefrontFooter } from "@/components/storefront/footer";
import { Toaster } from "@/components/ui/sonner";
import { getSiteSettings } from "@/lib/settings";
import { getAllPolicies } from "@/app/actions/policy";
import { StoreInitializer } from "@/components/store-initializer";
import { getDBCart } from "@/app/(storefront)/cart/actions";
import { AddedToCartModal } from "@/components/storefront/added-to-cart-modal";

import { CookieConsent } from "@/components/storefront/cookie-consent";
import { WhatsAppButton } from "@/components/storefront/whatsapp-button";
import { getStoreType, getStoreSettings, getStoreFilter } from "@/lib/store-helper";

export default async function StorefrontLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    const activeStore = await getStoreType();
    const storeSettings = await getStoreSettings(activeStore);
    const storeFilter = getStoreFilter(activeStore);

    const settings = {
        ...(await getSiteSettings()),
        logoUrl: storeSettings.logoUrl,
        siteName: storeSettings.siteTitle,
        phone: storeSettings.phone,
        email: storeSettings.email,
        address: storeSettings.address,
    };

    let categories: any[] = [];

    try {
        // 1. Try to fetch categories explicitly marked for header for current store
        categories = await prisma.category.findMany({
            where: {
                isActive: true,
                isInHeader: true,
                store: storeFilter,
            },
            orderBy: [
                { headerOrder: "asc" },
                { order: "asc" }
            ],
            select: {
                id: true,
                name: true,
                slug: true,
                parentId: true,
                imageUrl: true,
                menuImageUrl: true,
                isInHeader: true,
                children: {
                    where: { isActive: true },
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        imageUrl: true
                    },
                    orderBy: { order: "asc" }
                }
            }
        });

        // 2. Fallback: If no header categories found, fetch default ones (Home children or root)
        if (categories.length === 0) {
            categories = await prisma.category.findMany({
                where: {
                    isActive: true,
                    parent: { name: "Home" }
                },
                orderBy: { order: "asc" },
                take: 10,
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    parentId: true,
                    imageUrl: true,
                    menuImageUrl: true,
                    isInHeader: true,
                    children: {
                        where: { isActive: true },
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            imageUrl: true
                        },
                        orderBy: { order: "asc" }
                    }
                }
            });

            // 3. Second Fallback: If still no categories (maybe no "Home" category exists), fetch root categories
            if (categories.length === 0) {
                categories = await prisma.category.findMany({
                    where: {
                        isActive: true,
                        parentId: null,
                        store: storeFilter,
                    },
                    orderBy: { order: "asc" },
                    take: 10,
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        parentId: true,
                        imageUrl: true,
                        menuImageUrl: true,
                        isInHeader: true,
                        children: {
                            where: { isActive: true },
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                imageUrl: true
                            },
                            orderBy: { order: "asc" }
                        }
                    }
                });
            }
        }
    } catch (error) {
        console.warn("Could not fetch categories in StorefrontLayout, using empty array.", error);
        categories = [];
    }

    // Fetch sidebar categories (all active children of root) for mobile menu
    let sidebarCategories: any[] = [];
    try {
        sidebarCategories = await prisma.category.findMany({
            where: {
                isActive: true,
                parentId: null,
                store: storeFilter,
            },
            orderBy: { order: "asc" },
            select: {
                id: true,
                name: true,
                slug: true,
                children: {
                    where: { isActive: true },
                    select: { id: true, name: true, slug: true },
                    orderBy: { order: "asc" }
                }
            }
        });
    } catch (error) {
        console.warn("Could not fetch sidebar categories, using empty array.", error);
        sidebarCategories = [];
    }

    const policies = await getAllPolicies();

    let userDiscountRate = 0;
    if (session?.user?.id) {
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
            console.warn("Could not fetch user discount rate, using 0.", error);
        }
    }

    const dbCart = session?.user?.id ? await getDBCart(session.user.id, userDiscountRate) : null;

    return (
        <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
            <CookieConsent />
            <StoreInitializer
                discountRate={userDiscountRate}
                dbCart={dbCart}
                isAuthenticated={!!session?.user}
            />
            <AddedToCartModal />
            <StorefrontHeader
                user={session?.user}
                logoUrl={settings.logoUrl}
                siteName={settings.siteName}
                categories={categories}
                sidebarCategories={sidebarCategories}
                phone={settings.phone}
                facebookUrl={settings.facebookUrl}
                instagramUrl={settings.instagramUrl}
                twitterUrl={settings.twitterUrl}
                linkedinUrl={settings.linkedinUrl}
            />
            <main className="flex-1">{children}</main>
            <StorefrontFooter settings={settings} policies={policies} categories={categories} />
            <WhatsAppButton phone={settings.whatsappNumber || settings.phone} />
        </div>
    );
}

