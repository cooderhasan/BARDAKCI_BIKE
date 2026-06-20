import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
    try {
        const config = await (prisma as any).trendyolConfig.findFirst();
        if (!config) return NextResponse.json({ error: "No config found" });

        const gatewayUrl = "https://apigw.trendyol.com";
        const pair = `${config.apiKey}:${config.apiSecret}`;
        const headers: Record<string, string> = {
            "Authorization": `Basic ${Buffer.from(pair).toString("base64")}`,
            "User-Agent": `${config.supplierId} - SelfIntegration`,
            "Content-Type": "application/json"
        };

        // --- YENİ EKLENEN: TEST GÖNDERİMİ ---
        const url = new URL(request.url);
        const testBarcode = url.searchParams.get("testBarcode");

        if (testBarcode) {
            // Sadece test gönderimi yap ve sonucu dön
            const testProduct = await prisma.product.findFirst({
                where: { 
                    OR: [
                        { barcode: testBarcode },
                        { variants: { some: { barcode: testBarcode } } }
                    ]
                },
                include: { categories: true, brand: true, variants: true }
            });

            if (!testProduct) {
                return NextResponse.json({ error: "Ürün bulunamadı", testBarcode });
            }

            const mappedCat = (testProduct as any).categories?.find((c: any) => c.trendyolCategoryId !== null);
            const brandId = (testProduct as any).brand?.trendyolBrandId;

            const defaultAttributes = [
                { attributeId: 1192, attributeValueId: 10617300 },
                { attributeId: 338, attributeValueId: 6821 },
                { attributeId: 1201, attributeValueId: 10621829 },
                { attributeId: 1209, attributeValueId: 10621791 }
            ];

            const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";
            const imageUrls = testProduct.images
                .map((url: string) => url.startsWith("http") ? url : `${siteUrl}${url.startsWith("/") ? "" : "/"}${url}`)
                .filter((url: string) => url.startsWith("https://"));

            const items: any[] = [];
            const baseItem = {
                title: testProduct.name,
                productMainId: testProduct.sku || testProduct.id,
                brandId: Number(brandId),
                categoryId: Number(mappedCat?.trendyolCategoryId),
                description: testProduct.description || testProduct.name,
                currencyType: "TRY",
                vatRate: testProduct.vatRate,
                cargoCompanyId: Number(config.cargoCompanyId),
                shipmentAddressId: Number(config.shipmentAddressId),
                returningAddressId: Number(config.returningAddressId),
                deliveryOption: { deliveryDuration: 3, fastDeliveryType: "SAME_DAY_SHIPPING" },
                images: imageUrls.map((u: string) => ({ url: u })),
                attributes: defaultAttributes
            };

            const variant = (testProduct.variants as any[]).find(v => v.barcode === testBarcode);
            
            const baseListPrice = Number(testProduct.listPrice);
            let baseSalePrice = testProduct.trendyolPrice ? Number(testProduct.trendyolPrice) : baseListPrice;
            if (baseSalePrice > baseListPrice) baseSalePrice = baseListPrice;

            if (variant) {
                const variantListPrice = baseListPrice + Number(variant.priceAdjustment || 0);
                let variantSalePrice = baseSalePrice + Number(variant.priceAdjustment || 0);
                if (variantSalePrice > variantListPrice) variantSalePrice = variantListPrice;

                const availableStock = Math.max(0, variant.stock - (testProduct.criticalStock || 0));

                items.push({
                    ...baseItem,
                    barcode: variant.barcode,
                    stockCode: variant.sku || variant.barcode,
                    quantity: availableStock,
                    listPrice: variantListPrice,
                    salePrice: variantSalePrice,
                    dimensionalWeight: 1,
                });
            } else if (testProduct.barcode === testBarcode) {
                const availableStock = Math.max(0, testProduct.stock - (testProduct.criticalStock || 0));
                
                items.push({
                    ...baseItem,
                    barcode: testProduct.barcode,
                    stockCode: testProduct.sku || testProduct.barcode,
                    quantity: availableStock,
                    listPrice: baseListPrice,
                    salePrice: baseSalePrice,
                    dimensionalWeight: testProduct.desi ? Number(testProduct.desi) : 1,
                });
            }

            if (items.length === 0) {
                return NextResponse.json({ error: "Barkodlu varyant veya ürün bulunamadı", testBarcode });
            }

            const sendUrl = `${gatewayUrl}/integration/product/sellers/${config.supplierId}/products`;
            const sendRes = await fetch(sendUrl, {
                method: "POST",
                headers,
                body: JSON.stringify({ items })
            });

            const sendData = await sendRes.json();
            
            let batchResult = null;
            if (sendData.batchRequestId) {
                // Wait 10 seconds for batch to process
                await new Promise(r => setTimeout(r, 10000));
                
                try {
                    const batchUrl = `${gatewayUrl}/integration/product/sellers/${config.supplierId}/products/batch-requests/${sendData.batchRequestId}`;
                    const bRes = await fetch(batchUrl, { headers });
                    if (bRes.ok) {
                        batchResult = await bRes.json();
                    } else {
                        batchResult = { error: bRes.status, text: await bRes.text() };
                    }
                } catch (e: any) {
                    batchResult = { error: e.message };
                }
            }

            return NextResponse.json({
                testBarcode,
                payloadSent: items,
                trendyolResponse: sendData,
                batchResultAfter10s: batchResult
            });
        }
        // --- TEST GÖNDERİMİ BİTİŞ ---

        // 1. Son gönderilen ürünleri DB'den al
        let lastSyncedProducts: any[] = [];
        try {
            lastSyncedProducts = await (prisma as any).trendyolProduct.findMany({
                orderBy: { lastSyncedAt: "desc" },
                take: 5,
                include: { product: { select: { name: true, barcode: true, sku: true } } }
            });
        } catch (e) {}

        // 2. Her birinin barkodunu Trendyol'da ara
        const barcodeSearchResults: any = {};
        for (const sp of lastSyncedProducts) {
            const barcode = sp.barcode || sp.product?.barcode;
            if (!barcode) continue;
            
            try {
                const url = `${gatewayUrl}/integration/product/sellers/${config.supplierId}/products?barcode=${barcode}`;
                const res = await fetch(url, { headers });
                if (res.ok) {
                    const data = await res.json();
                    barcodeSearchResults[barcode] = {
                        found: data.totalElements > 0,
                        totalElements: data.totalElements,
                        products: data.content?.map((p: any) => ({
                            title: p.title,
                            approved: p.approved,
                            rejected: p.rejected,
                            onSale: p.onSale,
                            rejectReasonDetails: p.rejectReasonDetails,
                            quantity: p.quantity,
                            listPrice: p.listPrice,
                            salePrice: p.salePrice,
                        }))
                    };
                } else {
                    barcodeSearchResults[barcode] = { status: res.status, text: (await res.text()).substring(0, 200) };
                }
            } catch (e: any) {
                barcodeSearchResults[barcode] = { error: e.message };
            }
        }

        // 3. Trendyol'un toplam ürün sayısı
        let totalProductCount = 0;
        try {
            const countRes = await fetch(`${gatewayUrl}/integration/product/sellers/${config.supplierId}/products?page=0&size=1`, { headers });
            if (countRes.ok) {
                const countData = await countRes.json();
                totalProductCount = countData.totalElements;
            }
        } catch (e) {}

        // 4. Onay bekleyen (approved=false, rejected=false) ürünleri ara
        let pendingProducts: any = null;
        try {
            const pendingRes = await fetch(
                `${gatewayUrl}/integration/product/sellers/${config.supplierId}/products?approved=false&page=0&size=10`,
                { headers }
            );
            if (pendingRes.ok) {
                const pendingData = await pendingRes.json();
                pendingProducts = {
                    totalElements: pendingData.totalElements,
                    products: pendingData.content?.map((p: any) => ({
                        title: p.title,
                        barcode: p.barcode,
                        approved: p.approved,
                        rejected: p.rejected,
                        onSale: p.onSale,
                        rejectReasonDetails: p.rejectReasonDetails,
                        createDateTime: new Date(p.createDateTime).toISOString(),
                    }))
                };
            } else {
                pendingProducts = { status: pendingRes.status, text: (await pendingRes.text()).substring(0, 200) };
            }
        } catch (e: any) {
            pendingProducts = { error: e.message };
        }

        return NextResponse.json({
            totalApprovedProducts: totalProductCount,
            lastSyncedFromDB: lastSyncedProducts.map((p: any) => ({
                name: p.product?.name,
                barcode: p.barcode,
                isSynced: p.isSynced,
                lastSyncedAt: p.lastSyncedAt,
                lastSyncError: p.lastSyncError
            })),
            barcodeSearchResults,
            pendingProducts
        }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message, stack: e.stack });
    }
}
