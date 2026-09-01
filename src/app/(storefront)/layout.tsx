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

export const dynamic = "force-dynamic";

export default async function StorefrontLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    const activeStore = await getStoreType();
    const storeSettings = await getStoreSettings(activeStore);
    const storeFilter = getStoreFilter(activeStore);

    const siteSettings = await getSiteSettings();
    const settings: Record<string, any> = {
        ...siteSettings,
        logoUrl: storeSettings.logoUrl,
        siteName: storeSettings.siteTitle,
        seoDescription: storeSettings.seoDescription,
        phone: storeSettings.phone,
        email: storeSettings.email,
        address: storeSettings.address,
    };

    let categories: any[] = [];

    function sortHeaderCategories(cats: any[]) {
        const getPriority = (name: string): number => {
            const n = (name || "").toLocaleLowerCase("tr-TR").trim();
            
            // Yedek Parça is ALWAYS LAST
            if (n.includes("yedek parça") || n.includes("yedek parca") || n.includes("yedek")) {
                return 990;
            }
            // Aksesuar is ALWAYS NEXT TO LAST (before Yedek Parça)
            if (n.includes("aksesuar") || n.includes("ekipman")) {
                return 880;
            }
            
            // Bike categories standard hierarchy
            if (n.includes("çocuk") || n.includes("cocuk")) return 10;
            if (n.includes("dağ") || n.includes("dag")) return 20;
            if (n.includes("şehir") || n.includes("sehir")) return 30;
            if (n.includes("elektrikli") || n.includes("e-bike")) return 40;
            if (n.includes("katlanabilir") || n.includes("katlanır")) return 50;
            if (n.includes("yol") || n.includes("yarış") || n.includes("yaris") || n.includes("gravel")) return 60;
            
            return 100;
        };

        return cats.sort((a, b) => {
            const orderA = a.headerOrder ?? 0;
            const orderB = b.headerOrder ?? 0;
            
            // If explicit headerOrder differs, respect admin manual headerOrder
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            
            // If both have same headerOrder (e.g. both 0), apply deterministic business rules
            const prioA = getPriority(a.name || "");
            const prioB = getPriority(b.name || "");
            if (prioA !== prioB) {
                return prioA - prioB;
            }
            
            const sideOrderA = a.order ?? 0;
            const sideOrderB = b.order ?? 0;
            if (sideOrderA !== sideOrderB) {
                return sideOrderA - sideOrderB;
            }
            
            return (a.name || "").localeCompare(b.name || "", "tr-TR");
        });
    }

    try {
        if (activeStore === "MOTOR") {
            const motorTargetOrder = [
                "Motosiklet Yedek Parça",
                "Markaya Göre",
                "Motosiklet Aksesuar",
                "Bakım ve Tamir Ürünleri"
            ];

            const fetchedMotorCategories = await prisma.category.findMany({
                where: {
                    isActive: true,
                    store: storeFilter,
                    parentId: null,
                    name: { in: motorTargetOrder }
                },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    parentId: true,
                    imageUrl: true,
                    menuImageUrl: true,
                    isInHeader: true,
                    headerOrder: true,
                    order: true,
                    children: {
                        where: { isActive: true, store: storeFilter },
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

            if (fetchedMotorCategories.length > 0) {
                categories = fetchedMotorCategories.sort((a, b) => {
                    const idxA = motorTargetOrder.indexOf(a.name);
                    const idxB = motorTargetOrder.indexOf(b.name);
                    return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
                });
            }
        }

        if (categories.length === 0) {
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
                    headerOrder: true,
                    order: true,
                    children: {
                        where: { isActive: true, store: storeFilter },
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
                        store: storeFilter,
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
                        headerOrder: true,
                        order: true,
                        children: {
                            where: { isActive: true, store: storeFilter },
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
                            headerOrder: true,
                            order: true,
                            children: {
                                where: { isActive: true, store: storeFilter },
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

            if (categories.length > 0) {
                categories = sortHeaderCategories(categories);
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
                    where: { isActive: true, store: storeFilter },
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
                isMotor={activeStore === "MOTOR"}
            />
            <main className="flex-1">{children}</main>
            <StorefrontFooter settings={settings} policies={policies} categories={categories} />
            <WhatsAppButton phone={settings.whatsappNumber || settings.phone} />
        </div>
    );
}

