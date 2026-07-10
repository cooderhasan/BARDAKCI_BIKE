import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/storefront/product-detail";
import { JsonLd } from "@/components/seo/json-ld";
import { Metadata } from "next";
import { getProductReviews, getReviewStats } from "@/app/actions/review";

interface ProductPageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
    const { slug } = await params;
    const product = await prisma.product.findUnique({
        where: { slug, isActive: true },
        select: { name: true, description: true, images: true }
    });

    if (!product) return { title: "Ürün Bulunamadı" };

    // Strip HTML tags and create a clean description
    const cleanDesc = product.description?.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();
    
    // Truncate cleanly up to ~155 chars, adding ellipsis if it's too long
    const maxDescLength = 155;
    const description = cleanDesc 
        ? (cleanDesc.length > maxDescLength ? cleanDesc.slice(0, maxDescLength).trim() + "..." : cleanDesc)
        : `${product.name} uygun fiyat ve taksit seçenekleriyle Bardakcı Bike'ta.`;

    return {
        title: product.name, // Site name is appended automatically by layout.tsx
        description,
        openGraph: {
            title: product.name,
            description,
            images: product.images || [],
        },
        alternates: {
            canonical: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr"}/products/${slug}`
        }
    };
}

export default async function ProductPage({ params }: ProductPageProps) {
    const { slug } = await params;
    const session = await auth();
    const settings = await getSiteSettings();
    const discountRate = session?.user?.discountRate || 0;
    const isDealer =
        (session?.user?.role === "DEALER" && session?.user?.status === "APPROVED") ||
        session?.user?.role === "ADMIN" ||
        session?.user?.role === "OPERATOR";
    const isAuthenticated = !!session?.user;

    const product = await prisma.product.findUnique({
        where: { slug, isActive: true },
        include: {
            categories: {
                include: {
                    parent: {
                        include: {
                            parent: true
                        }
                    }
                }
            },
            brand: true,
            variants: {
                where: { isActive: true },
            },
        },
    });

    if (!product) {
        notFound();
    }

    console.log("Product slug:", slug);
    console.log("Product origin from DB:", product.origin);
    console.log("Product variants count:", product.variants.length);

    // Get related products
    const categoryIds = product.categories.map((c) => c.id);
    const relatedProducts = await prisma.product.findMany({
        where: {
            isActive: true,
            id: { not: product.id },
            ...(categoryIds.length > 0
                ? {
                      categories: {
                          some: {
                              id: { in: categoryIds },
                          },
                      },
                  }
                : product.categoryId
                ? {
                      categoryId: product.categoryId,
                  }
                : {}),
        },
        include: {
            category: true,
            brand: true,
            categories: {
                include: {
                    parent: {
                        include: {
                            parent: true
                        }
                    }
                }
            }
        },
        take: 6,
    });

    const reviews = await getProductReviews(product.id);
    const reviewStats = await getReviewStats(product.id);

    // Serialize product with variants
    const serializedProduct = {
        ...product,
        listPrice: Number(product.listPrice),
        salePrice: product.salePrice ? Number(product.salePrice) : null,
        weight: product.weight ? Number(product.weight) : null,
        width: product.width ? Number(product.width) : null,
        height: product.height ? Number(product.height) : null,
        length: product.length ? Number(product.length) : null,
        desi: product.desi ? Number(product.desi) : null,
        googlePrice: (product as any).googlePrice ? Number((product as any).googlePrice) : null,
        gtin: (product as any).gtin || null,
        mpn: (product as any).mpn || null,
        origin: product.origin,
        variants: product.variants.map(v => ({
            id: v.id,
            color: v.color,
            size: v.size,
            stock: v.stock,
            sku: v.sku,
            barcode: v.barcode,
            priceAdjustment: Number(v.priceAdjustment),
        })),
    };

    // Helper to build category breadcrumbs for JSON-LD
    const getCategoryPath = (cat: any) => {
        const path = [];
        let current = cat;
        while (current) {
            path.unshift(current);
            current = current.parent;
        }
        return path;
    };

    const primaryCategory = (product.categories || []).find((c: any) => c.parent) 
        || (product.categories || [])[0] 
        || null;
    const categoryPath = primaryCategory ? getCategoryPath(primaryCategory) : [];

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";
    const freeShippingLimit = Number(settings.freeShippingLimit) || 20000;
    const isFreeShipping = Number(product.listPrice) >= freeShippingLimit;

    // 1. Product Schema
    const productSchema: any = {
        "@type": "Product",
        "name": product.name,
        "image": product.images,
        "description": product.description?.replace(/<[^>]*>?/gm, "") || product.name, // Strip HTML
        "sku": product.sku || undefined,
        "mpn": product.mpn || product.sku || undefined,
        "gtin": product.gtin || product.barcode || undefined,
        "brand": {
            "@type": "Brand",
            "name": product.brand?.name || "Bardakcı Bike",
        },
        "offers": {
            "@type": "Offer",
            "url": `${baseUrl}/products/${product.slug}`,
            "priceCurrency": "TRY",
            "price": Number(product.listPrice),
            "priceValidUntil": new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
            "itemCondition": "https://schema.org/NewCondition",
            "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            "seller": {
                "@type": "Organization",
                "name": "Bardakcı Bike",
            },
            "shippingDetails": {
                "@type": "OfferShippingDetails",
                "shippingRate": {
                    "@type": "MonetaryAmount",
                    "value": isFreeShipping ? 0 : 90,
                    "currency": "TRY"
                },
                "shippingDestination": {
                    "@type": "DefinedRegion",
                    "addressCountry": "TR"
                },
                "deliveryTime": {
                    "@type": "ShippingDeliveryTime",
                    "handlingTime": {
                        "@type": "QuantitativeValue",
                        "minValue": 0,
                        "maxValue": 1,
                        "unitCode": "DAY"
                    },
                    "transitTime": {
                        "@type": "QuantitativeValue",
                        "minValue": 1,
                        "maxValue": 3,
                        "unitCode": "DAY"
                    }
                }
            },
            "hasMerchantReturnPolicy": {
                "@type": "MerchantReturnPolicy",
                "applicableCountry": "TR",
                "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
                "merchantReturnDays": 14,
                "returnMethod": "https://schema.org/ReturnByMail",
                "returnFees": "https://schema.org/FreeReturn"
            }
        },
    };

    // Enrich with review and rating data if available
    if (reviewStats.totalReviews > 0) {
        productSchema.aggregateRating = {
            "@type": "AggregateRating",
            "ratingValue": reviewStats.averageRating,
            "reviewCount": reviewStats.totalReviews,
        };
        productSchema.review = reviews.map(r => ({
            "@type": "Review",
            "author": {
                "@type": "Person",
                "name": r.user.companyName || r.user.email || "Müşteri",
            },
            "datePublished": r.createdAt.toISOString().split("T")[0],
            "reviewBody": r.comment || "",
            "reviewRating": {
                "@type": "Rating",
                "ratingValue": r.rating,
            },
        }));
    }

    // 2. BreadcrumbList Schema
    const breadcrumbListItems = [
        {
            "@type": "ListItem",
            "position": 1,
            "name": "Ana Sayfa",
            "item": baseUrl,
        }
    ];

    let currentPos = 2;
    categoryPath.forEach((cat: any) => {
        breadcrumbListItems.push({
            "@type": "ListItem",
            "position": currentPos++,
            "name": cat.name,
            "item": `${baseUrl}/category/${cat.slug}`,
        });
    });

    breadcrumbListItems.push({
        "@type": "ListItem",
        "position": currentPos,
        "name": product.name,
        "item": `${baseUrl}/products/${product.slug}`,
    });

    const breadcrumbSchema = {
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbListItems,
    };

    // Combine using @graph structure
    const schema = {
        "@context": "https://schema.org",
        "@graph": [
            productSchema,
            breadcrumbSchema
        ]
    };
    const paytrMerchantId = process.env.PAYTR_MERCHANT_ID || process.env.NEXT_PUBLIC_PAYTR_MERCHANT_ID || "";
    const paytrToken = process.env.NEXT_PUBLIC_PAYTR_TOKEN || "";

    return (
        <>
            <JsonLd data={schema} />
            <ProductDetail
                product={serializedProduct}
                relatedProducts={relatedProducts.map(p => ({
                    ...p,
                    listPrice: Number(p.listPrice),
                    salePrice: p.salePrice ? Number(p.salePrice) : null,
                    weight: p.weight ? Number(p.weight) : null,
                    width: p.width ? Number(p.width) : null,
                    height: p.height ? Number(p.height) : null,
                    length: p.length ? Number(p.length) : null,
                    desi: p.desi ? Number(p.desi) : null,
                    googlePrice: (p as any).googlePrice ? Number((p as any).googlePrice) : null,
                    origin: p.origin,
                }))}
                discountRate={discountRate}
                isDealer={isDealer}
                isAuthenticated={isAuthenticated}
                whatsappNumber={settings.whatsappNumber || settings.phone}
                reviews={reviews.map(r => ({
                    ...r,
                    user: {
                        name: r.user.companyName || r.user.email || "Misafir",
                        image: null
                    }
                }))}
                reviewStats={reviewStats}
                bankTransferDiscount={Number(settings.bankTransferDiscount) || 0}
                paytrMerchantId={paytrMerchantId}
                paytrToken={paytrToken}
            />
        </>
    );
}

