
"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getSiteSettings } from "@/app/admin/(protected)/settings/actions";

export async function getN11Config() {
    try {
        const config = await (prisma as any).n11Config.findFirst();
        return { success: true, data: config };
    } catch (error) {
        return { success: false, error: "Ayarlar alınamadı" };
    }
}

export async function saveN11Config(prevState: any, formData: FormData) {
    try {
        const apiKey = formData.get("apiKey") as string;
        const apiSecret = formData.get("apiSecret") as string;
        const isActive = formData.get("isActive") === "on";

        if (!apiKey || !apiSecret) {
            return { success: false, message: "API Anahtarı ve Şifre zorunludur." };
        }

        console.log("💾 N11 Saving Config:", { apiKey, isActive });

        const existing = await (prisma as any).n11Config.findFirst();

        if (existing) {
            await (prisma as any).n11Config.update({
                where: { id: existing.id },
                data: { apiKey, apiSecret, isActive }
            });
            console.log("✅ N11 Config Updated");
        } else {
            await (prisma as any).n11Config.create({
                data: { apiKey, apiSecret, isActive }
            });
            console.log("✅ N11 Config Created");
        }

        revalidatePath("/admin/integrations/n11");
        return { success: true, message: "N11 Ayarları başarıyla kaydedildi." };
    } catch (error) {
        return { success: false, message: "Kaydetme hatası." };
    }
}

export async function testN11Connection() {
    try {
        const config = await (prisma as any).n11Config.findFirst();
        if (!config) return { success: false, message: "Ayarlar bulunamadı." };

        const client = new N11Client({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret
        });

        const result = await client.checkConnectionDetailed();

        if (result.success) {
            return { success: true, message: "Bağlantı Başarılı! N11 API ile iletişim kuruldu." };
        } else {
            return { success: false, message: "Bağlantı Başarısız: " + result.message };
        }
    } catch (error: any) {
        return { success: false, message: "Sistem Hatası: " + error.message };
    }
}

import { N11Client } from "@/services/n11/api";

import { addMarketplaceSyncJob } from "@/lib/queue/producer";

export async function enqueueN11Sync() {
    try {
        await addMarketplaceSyncJob({ marketplace: "n11", type: "products" });
        return { success: true, message: "Senkronizasyon işlemi kuyruğa alındı. Arka planda işlenecektir." };
    } catch (error: any) {
        return { success: false, message: "Kuyruğa eklenirken hata oluştu: " + error.message };
    }
}

export async function syncProductsToN11(productIds?: string[]) {
    try {
        const config = await (prisma as any).n11Config.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon bulunamadı." };

        const whereClause: any = {
            isActive: true,
            isN11Active: true
        };

        if (productIds && productIds.length > 0) {
            whereClause.id = { in: productIds };
        }

        // Fetch products with variants
        const products = await prisma.product.findMany({
            where: whereClause,
            include: { variants: true, categories: true }
        });

        if (products.length === 0) return { success: false, message: "Ürün bulunamadı." };

        const client = new N11Client({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret
        });

        let successCount = 0;
        let failCount = 0;

        // 1. Collect all items to sync across all products
        const allItemsToSync = [];

        // Fetch default critical stock from settings
        const generalSettings = await getSiteSettings("general");
        const defaultCritical = Number(generalSettings?.defaultCriticalStock || 10);

        for (const p of products) {
            const basePrice = Number((p as any).n11Price) || Number(p.listPrice);
            const criticalStock = p.criticalStock ?? defaultCritical;

            if ((p as any).variants?.length > 0) {
                for (const v of (p as any).variants) {
                    if (v.barcode) {
                        const availableStock = Math.max(0, v.stock - criticalStock);
                        const n11Price = Number(p.n11Price || p.listPrice);
                        const finalSalePrice = n11Price + Number(v.priceAdjustment || 0);
                        const finalListPrice = Math.max(finalSalePrice, Number(p.listPrice) + Number(v.priceAdjustment || 0));

                        allItemsToSync.push({
                            stockCode: v.sku || v.barcode,
                            quantity: availableStock,
                            salePrice: finalSalePrice,
                            listPrice: finalListPrice,
                            currencyType: "TL"
                        });
                    }
                }
            } else if ((p as any).barcode) {
                const availableStock = Math.max(0, p.stock - criticalStock);
                const finalSalePrice = Number(p.n11Price || p.listPrice);
                const finalListPrice = Math.max(finalSalePrice, Number(p.listPrice));

                allItemsToSync.push({
                    stockCode: p.sku || p.barcode,
                    quantity: availableStock,
                    salePrice: finalSalePrice,
                    listPrice: finalListPrice,
                    currencyType: "TL"
                });
            }
        }

        // 2. Process in chunks (N11 allows up to 1000 skus per task)
        const CHUNK_SIZE = 1000;
        const chunks = [];
        for (let i = 0; i < allItemsToSync.length; i += CHUNK_SIZE) {
            chunks.push(allItemsToSync.slice(i, i + CHUNK_SIZE));
        }

        for (const chunk of chunks) {
            const result = await client.updateStockAndPrice(chunk);
            if (result.success) {
                successCount += chunk.length;
            } else {
                failCount += chunk.length;
            }
        }

        return { success: true, message: `N11 Senkronizasyonu Tamamlandı. ${successCount} varyant/ürün güncellendi.` };

    } catch (error: any) {
        console.error("N11 Sync Error:", error);
        return { success: false, message: "Sync Hatası: " + error.message };
    }
}

export async function syncOrdersFromN11() {
    try {
        const config = await (prisma as any).n11Config.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon bulunamadı." };

        const client = new N11Client({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret
        });

        // Official Doc: Fetching "Created" status (New orders)
        const response = await client.getOrders("Created");
        if (!response.success) throw new Error(response.message);

        // Official Doc: Orders are in 'content' array as packages
        const packages = response.content || [];
        let importedCount = 0;

        for (const pkg of packages) {
            // Check if this order package already exists in our DB
            const existing = await prisma.order.findUnique({
                where: { orderNumber: pkg.orderNumber }
            });

            if (existing) continue;

            const orderItems: any[] = [];
            const lineIds: number[] = [];
            let total = 0;

            // Official Doc: Each package has 'lines'
            for (const line of (pkg.lines || [])) {
                lineIds.push(line.orderLineId);
                
                // Find product by barcode or stockCode
                const product = await prisma.product.findFirst({
                    where: {
                        OR: [
                            { barcode: line.barcode || undefined },
                            { sku: line.stockCode || undefined }
                        ]
                    }
                });

                if (product) {
                    orderItems.push({
                        productId: product.id,
                        quantity: line.quantity,
                        unitPrice: line.price,
                        productName: line.productName,
                        lineTotal: line.price * line.quantity,
                        vatRate: line.vatRate || 20
                    });
                    total += line.price * line.quantity;

                    // Update local stock
                    await prisma.product.update({
                        where: { id: product.id },
                        data: { stock: { decrement: line.quantity } }
                    });
                }
            }

            if (orderItems.length > 0) {
                await prisma.order.create({
                    data: {
                        orderNumber: pkg.orderNumber,
                        status: "CONFIRMED",
                        total: pkg.totalAmount || total,
                        subtotal: total,
                        discountAmount: pkg.totalDiscountAmount || 0,
                        appliedDiscountRate: 0,
                        vatAmount: total * 0.2, // Default VAT
                        guestEmail: pkg.customerEmail || "n11@customer.com",
                        shippingAddress: {
                            fullName: pkg.shippingAddress?.fullName || pkg.customerfullName || "N11 Müşterisi",
                            address: pkg.shippingAddress?.address || "",
                            city: pkg.shippingAddress?.city || "",
                            district: pkg.shippingAddress?.district || ""
                        },
                        items: { create: orderItems },
                        source: "N11",
                        cargoTrackingNumber: pkg.cargoTrackingNumber || null,
                        shipmentPackageId: String(pkg.id || ""),
                        cargoCompany: pkg.cargoProviderName || null
                    }
                });

                // AUTOMATIC STOCK CONFIRMATION (Official: PUT /rest/order/v1/update with status 'Picking')
                try {
                    const acceptRes = await client.acceptOrder(lineIds);
                    if (acceptRes.success) {
                        console.log(`✅ N11 Package ${pkg.id} (Order ${pkg.orderNumber}) auto-accepted via Picking status.`);
                    } else {
                        console.error(`❌ N11 Auto-Accept Error for Order ${pkg.orderNumber}:`, acceptRes.message);
                    }
                } catch (acceptErr) {
                    console.error(`❌ N11 Auto-Accept Exception for Order ${pkg.orderNumber}:`, acceptErr);
                }

                importedCount++;
            }
        }

        return { success: true, message: `${importedCount} yeni N11 siparişi başarıyla çekildi.` };

    } catch (error: any) {
        console.error("N11 Order Sync Error:", error);
        return { success: false, message: "Order Sync Hatası: " + error.message };
    }
}
export async function getN11CategoryAttributes(categoryId: number) {
    try {
        const config = await (prisma as any).n11Config.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon bulunamadı." };

        const client = new N11Client({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret
        });

        const data = await client.getCategoryAttributes(categoryId);
        return { success: true, data: data.attributes };
    } catch (error: any) {
        return { success: false, message: "Hata: " + error.message };
    }
}

export async function getN11Categories(parentId?: number) {
    try {
        const config = await (prisma as any).n11Config.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon yok." };

        const client = new N11Client({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret
        });

        if (parentId) {
            const res = await client.getSubCategories(parentId);
            return { success: true, data: (res as any).categories || [] };
        } else {
            const res = await client.getTopLevelCategories();
            return { success: true, data: (res as any).categories || [] };
        }
    } catch (error: any) {
        return { success: false, message: "Kategoriler alınamadı: " + error.message };
    }
}

// Full list for searching (This might be slow if many categories, but needed for flat search)
export async function getFlatN11Categories() {
    try {
        const config = await (prisma as any).n11Config.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon yok." };

        const client = new N11Client({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret
        });

        const res = await client.getAllCategories();
        return res;
    } catch (error: any) {
        return { success: false, message: "Hata: " + error.message };
    }
}

export async function sendProductToN11(productId: string, attributes: any[]) {
    try {
        const config = await (prisma as any).n11Config.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon bulunamadı." };

        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: {
                brand: true,
                categories: true,
                variants: true
            }
        });

        if (!product) return { success: false, message: "Ürün bulunamadı." };

        const client = new N11Client({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret
        });

        const mappedCat = product.categories.find((c: any) => c.n11CategoryId !== null);
        if (!mappedCat) return { success: false, message: "Ürünün kategorisi N11 ile eşleşmemiş." };

        // Build attributes in REST API format: { id, valueId, customValue }
        // UI sends attributes with id, valueId, customValue - pass through directly
        const mappedAttributes = attributes.map((attr: any) => ({
            id: attr.id,
            valueId: attr.valueId ?? null,
            customValue: attr.customValue ?? null
        }));

        // Determine if product has variants
        const hasVariants = (product as any).variants && (product as any).variants.length > 0;

        const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.serinmotor.com";
        
        // Görselleri tam URL'ye çevir (N11 tam URL ve tercihen https bekler)
        const absoluteImages = (product.images || []).map((url: string) => {
            if (url.startsWith("http")) return url;
            const baseUrl = siteUrl.replace(/\/$/, "");
            const cleanUrl = url.startsWith("/") ? url : `/${url}`;
            return `${baseUrl}${cleanUrl}`;
        });

        // productMainId is required and must be same for all variants
        const productMainId = product.sku || product.id;

        let payload: any;

        if (hasVariants) {
            // Variant product: each variant becomes a separate SKU with same productMainId
            // N11 groups variants by productMainId - each variant is a separate SKU
            const skus = (product as any).variants.map((variant: any, index: number) => {
                // Variant title includes color/size for distinction
                const variantTitle = `${product.name} ${variant.color || ''} ${variant.size || ''}`.trim();
                
                return {
                    title: variantTitle,
                    description: product.description || product.name,
                    categoryId: mappedCat.n11CategoryId,
                    currencyType: "TL",
                    productMainId: productMainId,
                    preparingDay: 3,
                    shipmentTemplate: (product as any).shipmentTemplate || "Karaaslan",
                    stockCode: variant.sku || variant.barcode || `${product.id}-${index}`,
                    barcode: variant.barcode || null,
                    salePrice: Number(product.n11Price || product.listPrice) + Number(variant.priceAdjustment || 0),
                    listPrice: Math.max(Number(product.n11Price || product.listPrice) + Number(variant.priceAdjustment || 0), Number(product.listPrice) + Number(variant.priceAdjustment || 0)),
                    vatRate: 20,
                    quantity: variant.stock || 0,
                    images: absoluteImages,
                    // Only use mapped attributes from UI (with valid IDs)
                    // Variant-specific info (color/size) goes into title, not attributes
                    // because N11 requires category attribute IDs for variant attributes
                    attributes: mappedAttributes
                };
            });

            payload = {
                title: product.name,
                description: product.description || product.name,
                categoryId: mappedCat.n11CategoryId,
                currencyType: "TL",
                productMainId: productMainId,
                preparingDay: 3,
                shipmentTemplate: (product as any).shipmentTemplate || "Karaaslan",
                stockCode: product.sku || product.id,
                barcode: product.barcode || null,
                salePrice: Number(product.n11Price || product.listPrice),
                listPrice: Number(product.n11Price || product.listPrice),
                vatRate: 20,
                quantity: product.stock || 0,
                images: absoluteImages,
                attributes: mappedAttributes,
                // For variant products, send all variants as separate skus
                _skus: skus // Internal flag for api.ts to handle
            };
        } else {
            // Single product (no variants)
            payload = {
                title: product.name,
                description: product.description || product.name,
                categoryId: mappedCat.n11CategoryId,
                currencyType: "TL",
                productMainId: productMainId,
                preparingDay: 3,
                shipmentTemplate: (product as any).shipmentTemplate || "Karaaslan",
                stockCode: product.sku || product.id,
                barcode: product.barcode || null,
                salePrice: Number(product.n11Price || product.listPrice),
                listPrice: Math.max(Number(product.n11Price || product.listPrice), Number(product.listPrice)),
                vatRate: 20,
                quantity: product.stock || 0,
                images: absoluteImages,
                attributes: mappedAttributes
            };
        }


        const result = await client.saveProduct(payload);

        if (result.success && result.taskId) {
            // Get or create N11 product record
            const n11Product = await (prisma as any).n11Product.upsert({
                where: { productId: product.id },
                update: {},
                create: { productId: product.id, isSynced: false }
            });

            // Create Task record
            await (prisma as any).n11Task.create({
                data: {
                    n11ProductId: n11Product.id,
                    taskId: String(result.taskId),
                    status: "PENDING"
                }
            });

            // Wait for 5 seconds for N11 to process the task
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Poll task details for final result
            let taskRes;
            try {
                taskRes = await client.getTaskDetails(String(result.taskId));
            } catch (pollError: any) {
                console.error(`N11 Task Polling Error [${result.taskId}]:`, pollError.message);
                // Task is created but polling failed - leave it as PENDING for background sync
                return { success: true, message: `Ürün N11 kuyruğuna alındı. Takip No: ${result.taskId}. Durum senkronizasyon ile güncellenecek.` };
            }
            
            if (taskRes.success && taskRes.data) {
                const task = taskRes.data;
                const status = task.status; // COMPLETED, FAILED, IN_PROGRESS
                
                let errorMsg = null;
                if (status === "FAILED") {
                    // N11 often puts error in items[0].errorDescription or errorMsg
                    const firstItem = task.items?.[0];
                    errorMsg = firstItem?.errorDescription || firstItem?.errorMsg || firstItem?.errorMessage || "N11 İşleme Hatası";
                }

                // Update Task status in DB
                await (prisma as any).n11Task.update({
                    where: { taskId: String(result.taskId) },
                    data: { 
                        status: status,
                        errorMessage: errorMsg
                    }
                });

                if (status === "COMPLETED") {
                    await (prisma as any).n11Product.update({
                        where: { id: n11Product.id },
                        data: { isSynced: true, lastSyncedAt: new Date(), lastSyncError: null }
                    });
                    return { success: true, message: "Ürün N11'e başarıyla yüklendi ve yayınlandı." };
                } else if (status === "FAILED") {
                    await (prisma as any).n11Product.update({
                        where: { id: n11Product.id },
                        data: { lastSyncError: errorMsg }
                    });
                    return { success: false, message: "N11 İşleme Hatası: " + errorMsg };
                } else {
                    return { success: true, message: `Ürün N11 kuyruğuna alındı (Durum: ${status}). Takip No: ${result.taskId}. Birazdan tekrar kontrol ediniz.` };
                }
            }
            
            return { success: true, message: "Ürün N11 kuyruğuna iletildi. Sonuç için birazdan senkronizasyon yapabilirsiniz." };
        } else {
            return { success: false, message: "N11 İletim Hatası: " + result.message };
        }

    } catch (error: any) {
        return { success: false, message: "Hata: " + error.message };
    }
}

export async function getN11Tasks() {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    // Get tasks from DB
    const tasks = await (prisma as any).n11Task.findMany({
        include: {
            n11Product: {
                include: {
                    product: {
                        select: { name: true, sku: true, id: true }
                    }
                }
            }
        },
        orderBy: { createdAt: "desc" },
        take: 50
    });

    // Check if any task is still PENDING and try to update it from N11
    const pendingTasks = tasks.filter((t: any) => t.status === "PENDING" || t.status === "IN_PROGRESS");
    
    if (pendingTasks.length > 0) {
        const { N11Client } = await import("@/services/n11/api");
        const client = new N11Client();
        await client.init(); // CRITICAL: Initialize with credentials

        for (const task of pendingTasks) {
            try {
                // Add a small delay between requests to avoid overloading N11 server
                await new Promise(resolve => setTimeout(resolve, 500));

                const res = await client.getTaskDetails(task.taskId);
                if (res.success && res.data) {
                    const rawStatus = String(res.data.status || res.data.state || res.data.result || "").toUpperCase();
                    
                    // Normalize status
                    let n11Status = task.status;
                    const successStates = ["COMPLETED", "SUCCESS", "FINISHED", "PROCESSED", "DONE"];
                    const failedStates = ["FAILED", "ERROR", "REJECTED", "FAIL", "CANCELLED"];
                    const processingStates = ["IN_PROGRESS", "PROCESSING", "WORKING", "RUNNING"];

                    if (successStates.includes(rawStatus)) n11Status = "COMPLETED";
                    else if (failedStates.includes(rawStatus)) n11Status = "FAILED";
                    else if (processingStates.includes(rawStatus)) n11Status = "IN_PROGRESS";
                    else if (["PENDING", "WAITING", "CREATED", "QUEUED"].includes(rawStatus)) n11Status = "PENDING";

                    // Check individual items if overall status is unclear
                    if (n11Status === "PENDING" && res.data.items && res.data.items.length > 0) {
                        const allItemsDone = res.data.items.every((item: any) => 
                            successStates.includes(String(item.status || "").toUpperCase())
                        );
                        if (allItemsDone) n11Status = "COMPLETED";
                        
                        const anyItemFailed = res.data.items.some((item: any) => 
                            failedStates.includes(String(item.status || "").toUpperCase())
                        );
                        if (anyItemFailed && !allItemsDone) n11Status = "FAILED";
                    }

                    if (n11Status !== task.status || n11Status === "FAILED") {
                        // Update in DB
                        const items = res.data.items || res.data.content || [];
                        const firstItem = items[0];
                        const reasons = firstItem?.reasons ? (Array.isArray(firstItem.reasons) ? firstItem.reasons.join(", ") : String(firstItem.reasons)) : null;
                        const errorMsg = n11Status === "FAILED" ? (reasons || firstItem?.errorDescription || firstItem?.errorMsg || firstItem?.errorMessage || "İşleme hatası") : null;
                        
                        await (prisma as any).n11Task.update({
                            where: { id: task.id },
                            data: { 
                                status: n11Status,
                                errorMessage: errorMsg || (n11Status === "PENDING" ? `N11 Durumu: ${rawStatus}` : null)
                            }
                        });

                        // If completed, update product status too
                        if (n11Status === "COMPLETED") {
                            await (prisma as any).n11Product.update({
                                where: { id: task.n11ProductId },
                                data: { isSynced: true, lastSyncedAt: new Date(), lastSyncError: null }
                            });
                        }
                    }
                } else if (!res.success) {
                    // Plan B: Check if product exists via SOAP using sellerCode
                    // This is useful when REST polling is down but product was actually created
                    const sku = task.n11Product?.sellerCode || task.n11Product?.product?.sku || task.n11Product?.product?.id;
                    if (sku) {
                        console.log(`Polling failed for ${task.taskId}, trying Plan B (SOAP) for SKU: ${sku}`);
                        const soapRes = await client.getProductBySellerCode(sku);
                        if (soapRes.success && soapRes.exists) {
                            console.log(`Product ${sku} found via SOAP fallback! Marking task ${task.taskId} as COMPLETED.`);
                            await (prisma as any).n11Task.update({
                                where: { id: task.id },
                                data: { status: "COMPLETED", errorMessage: null }
                            });
                            await (prisma as any).n11Product.update({
                                where: { id: task.n11ProductId },
                                data: { isSynced: true, lastSyncedAt: new Date(), lastSyncError: null }
                            });
                        }
                    }
                }
            } catch (e: any) {
                console.error(`Task poll error for ${task.taskId}:`, e);
                // Also log catch-all errors
                await (prisma as any).n11Task.update({
                    where: { id: task.id },
                    data: { errorMessage: `Sistem Hatası: ${e.message}` }
                });
            }
        }


        // Fetch again to get updated statuses
        return await (prisma as any).n11Task.findMany({
            include: {
                n11Product: {
                    include: {
                        product: {
                            select: { name: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: "desc" },
            take: 50
        });
    }

    return tasks;
}
