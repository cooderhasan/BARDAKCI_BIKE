"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { sendShippingNotificationEmail } from "@/lib/email";
import {
    createYKShipment,
    cancelYKShipment,
    queryYKShipment,
    normalizePhone,
    type YKCredentials,
} from "@/services/yurtici/api";

export async function updateOrderStatus(
    orderId: string,
    status: "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED"
) {
    try {
        const session = await auth();

        if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
            throw new Error("Unauthorized");
        }

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { status: true, orderNumber: true, source: true },
        });

        const updated = await prisma.order.update({
            where: { id: orderId },
            data: { status },
        });

        // If Trendyol Order and Status is PROCESSING, update Trendyol to Picking
        if (order?.source === "TRENDYOL" && status === "PROCESSING") {
            try {
                const { updateTrendyolOrderToPicking } = await import("@/app/admin/(protected)/integrations/trendyol/actions");
                await updateTrendyolOrderToPicking(order.orderNumber);
            } catch (err) {
                console.error("Failed to sync status to Trendyol:", err);
            }
        }

        await prisma.adminLog.create({
            data: {
                adminId: session.user.id,
                action: "UPDATE_ORDER_STATUS",
                entityType: "Order",
                entityId: orderId,
                oldData: { status: order?.status ?? null },
                newData: { status },
            },
        });

        revalidatePath("/admin/orders");
        return { success: true };
    } catch (error) {
        console.error("Order status update error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Durum güncellenemedi." };
    }
}

export async function updateOrderTracking(orderId: string, trackingUrl: string) {
    try {
        const session = await auth();

        if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
            throw new Error("Unauthorized");
        }

        const order = await prisma.order.update({
            where: { id: orderId },
            data: { trackingUrl },
            include: {
                user: {
                    select: { email: true, companyName: true }
                }
            }
        });

        // Send Notification Email
        // If we have a tracking URL (not empty) and we haven't just cleared it
        if (trackingUrl && trackingUrl.trim() !== "") {
            const email = order.user?.email || order.guestEmail;
            const customerName = order.user?.companyName || order.guestEmail || "Müşteri";

            if (email) {
                // Fire and forget - don't block the UI for email sending
                sendShippingNotificationEmail({
                    to: email,
                    customerName: customerName,
                    orderNumber: order.orderNumber,
                    cargoCompany: order.cargoCompany || "Kargo",
                    trackingUrl: trackingUrl
                }).catch(err => {
                    console.error("Failed to send shipping notification:", err);
                });
            }
        }

        await prisma.adminLog.create({
            data: {
                adminId: session.user.id,
                action: "UPDATE_ORDER_TRACKING",
                entityType: "Order",
                entityId: orderId,
                newData: { trackingUrl },
            },
        });

        revalidatePath("/admin/orders");
        return { success: true };
    } catch (error) {
        console.error("Order tracking update error:", error);
        return { success: false, error: "Takip linki güncellenemedi." };
    }
}

export async function bulkUpdateOrderStatus(
    orderIds: string[],
    status: "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED"
) {
    try {
        const session = await auth();

        if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
            throw new Error("Unauthorized");
        }

        // Update all selected orders
        await prisma.order.updateMany({
            where: {
                id: { in: orderIds },
            },
            data: { status },
        });

        // Log the bulk action (simplified log)
        await prisma.adminLog.create({
            data: {
                adminId: session.user.id,
                action: "BULK_UPDATE_ORDER_STATUS",
                entityType: "Order",
                entityId: "BULK",
                newData: { orderIds, status },
            },
        });

        revalidatePath("/admin/orders");
        return { success: true };
    } catch (error) {
        console.error("Bulk order status update error:", error);
        return { success: false, error: "Toplu güncelleme başarısız oldu." };
    }
}

// ==================== YURTİÇİ KARGO ACTIONS ====================

/**
 * YK DB konfigürasyonunu getirir.
 * Aktif konfigürasyon yoksa null döner.
 */
async function getYKConfig(): Promise<YKCredentials | null> {
    const config = await prisma.yurticiKargoConfig.findFirst({
        where: { isActive: true },
    });
    if (!config) return null;
    return {
        username: config.username,
        password: config.password,
        customerCode: config.customerCode,
        unitCode: config.unitCode,
        demandNo: config.demandNo,
        isTestMode: config.isTestMode,
    };
}

/**
 * Siparişi YK sistemine gönderir.
 * Admin "YK'ya Gönder" butonuna bastığında çağrılır.
 */
export async function sendOrderToYurtici(orderId: string) {
    try {
        const session = await auth();
        if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
            throw new Error("Unauthorized");
        }

        const creds = await getYKConfig();
        if (!creds) {
            return { success: false, error: "Yurtiçi Kargo entegrasyonu yapılandırılmamış. Lütfen entegrasyon ayarlarını tamamlayın." };
        }

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                user: { select: { email: true, phone: true } },
            },
        });

        if (!order) return { success: false, error: "Sipariş bulunamadı." };
        if (order.ykJobId) {
            const errMsg = "Bu sipariş zaten Yurtiçi Kargo sistemine gönderilmiş. (Job ID: " + order.ykJobId + ")";
            await prisma.order.update({
                where: { id: orderId },
                data: { ykError: errMsg }
            });
            return { success: false, error: errMsg };
        }

        const shippingAddr = order.shippingAddress as any;
        if (!shippingAddr) return { success: false, error: "Siparişe ait teslimat adresi bulunamadı." };

        // Alıcı adı: teslimat adresindeki isim
        const receiverName = (shippingAddr.name || shippingAddr.fullName || shippingAddr.title || order.user?.email || "Müşteri").trim();
        if (receiverName.length < 2) {
            return { success: false, error: `Alıcı adı çok kısa (min 2 karakter): "${receiverName}"` };
        }

        // Adres: şehir ve ilçe ayrı gönderildiğinden onları adresten çıkarmaya gerek yok
        const rawAddress = (shippingAddr.address || shippingAddr.line1 || "").trim();
        const address = rawAddress.length < 10 ? rawAddress + " (Detay için müşteri aranmalı)" : rawAddress;

        // Şehir / İlçe
        const cityName = (shippingAddr.city || shippingAddr.province || "").trim();
        const townName = (shippingAddr.district || shippingAddr.town || "").trim();

        // Telefon: şu sırayla dene: teslimat adresi > kullanıcı profili
        const rawPhone = shippingAddr.phone || order.user?.phone || "";
        if (!rawPhone) return { success: false, error: "Alıcıya ait telefon numarası bulunamadı." };
        const phone = normalizePhone(rawPhone);
        if (phone.length !== 10) {
            return { success: false, error: `Telefon numarası geçersiz (10 hane olmalı): "${phone}"` };
        }

        // cargoKey: orderNumber (max 20 karakter)
        const cargoKey = order.orderNumber.slice(0, 20);

        const result = await createYKShipment(
            {
                cargoKey,
                invoiceKey: cargoKey,
                receiverCustName: receiverName,
                receiverAddress: address,
                cityName,
                townName,
                receiverPhone1: phone,
                emailAddress: order.user?.email || order.guestEmail || undefined,
                cargoCount: 1,
                description: `Sipariş #${order.orderNumber}`,
            },
            creds
        );

        // Her durumda DB'yi güncelle
        await prisma.order.update({
            where: { id: orderId },
            data: {
                ykCargoKey: cargoKey,
                ykJobId: result.jobId ?? null,
                ykStatus: result.success ? "NOP" : null,
                ykError: result.success ? null : (result.errMessage || result.outResult),
                ykSyncedAt: new Date(),
            },
        });

        if (result.success) {
            await prisma.adminLog.create({
                data: {
                    adminId: session.user.id,
                    action: "YK_CREATE_SHIPMENT",
                    entityType: "Order",
                    entityId: orderId,
                    newData: { cargoKey, jobId: result.jobId, isTestMode: creds.isTestMode },
                },
            });
            revalidatePath("/admin/orders");
            return { success: true, jobId: result.jobId, cargoKey, isTestMode: creds.isTestMode };
        } else {
            return { success: false, error: result.errMessage || result.outResult || "Bilinmeyen hata" };
        }
    } catch (error) {
        console.error("[YK] sendOrderToYurtici error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Bir hata oluştu." };
    }
}

/**
 * YK'da kayıtlı gönderiyi iptal eder.
 */
export async function cancelYKOrder(orderId: string) {
    try {
        const session = await auth();
        if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
            throw new Error("Unauthorized");
        }

        const creds = await getYKConfig();
        if (!creds) return { success: false, error: "YK entegrasyonu yapılandırılmamış." };

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { ykCargoKey: true, ykJobId: true, orderNumber: true },
        });

        if (!order?.ykCargoKey) return { success: false, error: "Bu sipariş YK sistemine gönderilmemiş." };

        const result = await cancelYKShipment(order.ykCargoKey, creds);

        await prisma.order.update({
            where: { id: orderId },
            data: {
                ykStatus: result.operationStatus ?? null,
                ykStatusMessage: result.operationMessage ?? null,
                ykError: result.success ? null : (result.errMessage || undefined),
                ykSyncedAt: new Date(),
            },
        });

        revalidatePath("/admin/orders");
        return {
            success: result.success,
            operationStatus: result.operationStatus,
            operationMessage: result.operationMessage,
            error: result.success ? undefined : (result.errMessage || "İptal başarısız."),
        };
    } catch (error) {
        console.error("[YK] cancelYKOrder error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Bir hata oluştu." };
    }
}

/**
 * YK'dan kargo durumunu sorgular ve DB'yi günceller.
 */
export async function queryYKOrder(orderId: string) {
    try {
        const session = await auth();
        if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
            throw new Error("Unauthorized");
        }

        const creds = await getYKConfig();
        if (!creds) return { success: false, error: "YK entegrasyonu yapılandırılmamış." };

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { ykCargoKey: true, ykSyncedAt: true },
        });

        if (!order?.ykCargoKey) return { success: false, error: "Bu sipariş YK sistemine gönderilmemiş." };

        // YK: 1 dakika içinde tekrarlı sorgu hatası fırlatıyor
        if (order.ykSyncedAt) {
            const secondsSinceSync = (Date.now() - new Date(order.ykSyncedAt).getTime()) / 1000;
            if (secondsSinceSync < 65) {
                return { success: false, error: `Son sorgulama ${Math.ceil(65 - secondsSinceSync)} saniye önce yapıldı. Lütfen biraz bekleyin.` };
            }
        }

        const result = await queryYKShipment(order.ykCargoKey, creds);

        // YK Status -> Order Status eşleştirmesi
        let newOrderStatus: any = undefined;
        if (result.operationStatus === "IND") {
            newOrderStatus = "SHIPPED";
        } else if (result.operationStatus === "DLV") {
            newOrderStatus = "DELIVERED";
        } else if (result.operationStatus === "CNL" || result.operationStatus === "ISC" || result.operationStatus === "BI") {
            newOrderStatus = "CANCELLED";
        }

        await prisma.order.update({
            where: { id: orderId },
            data: {
                ykStatus: result.operationStatus ?? null,
                ykStatusMessage: result.operationMessage ?? null,
                ykDocId: result.docId ?? null,
                ykError: result.success ? null : (result.errMessage || undefined),
                ykSyncedAt: new Date(),
                // Teslim edildiyse takip URL'ini de güncelle
                ...(result.trackingUrl ? { trackingUrl: result.trackingUrl } : {}),
                // Ana sipariş durumunu güncelle
                ...(newOrderStatus ? { status: newOrderStatus } : {}),
            },
        });

        revalidatePath("/admin/orders");
        return {
            success: result.success,
            operationStatus: result.operationStatus,
            operationMessage: result.operationMessage,
            docId: result.docId,
            trackingUrl: result.trackingUrl,
            error: result.success ? undefined : (result.errMessage || "Sorgu başarısız."),
        };
    } catch (error) {
        console.error("[YK] queryYKOrder error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Bir hata oluştu." };
    }
}

/**
 * Sistemdeki tüm aktif YK kargolarını toplu olarak senkronize eder.
 * (Teslim edilmemiş ve iptal edilmemiş olanları sorgular)
 */
export async function syncAllYKOrders() {
    try {
        const session = await auth();
        if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
            throw new Error("Unauthorized");
        }

        const creds = await getYKConfig();
        if (!creds) return { success: false, error: "YK entegrasyonu yapılandırılmamış." };

        // Son 14 günü hesapla
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        // Güncellenecek siparişleri bul: YK anahtarı olan ama henüz teslim/iptal edilmemişler
        // Performans için sadece son 14 günün siparişlerine bakıyoruz.
        const activeOrders = await prisma.order.findMany({
            where: {
                ykCargoKey: { not: null },
                status: {
                    notIn: ["DELIVERED", "CANCELLED"]
                },
                createdAt: {
                    gte: fourteenDaysAgo
                }
            },
            select: { id: true, ykCargoKey: true, orderNumber: true, ykSyncedAt: true }
        });

        if (activeOrders.length === 0) {
            return { success: true, count: 0, message: "Senkronize edilecek aktif kargo bulunamadı." };
        }

        let updatedCount = 0;
        let deliveredCount = 0;
        let errorCount = 0;

        // Performans ve YK limitleri için seri (sequential) işleme
        for (const order of activeOrders) {
            try {
                // Her sipariş arasında kısa bir bekleme (opsiyonel, YK'nın 1dk kısıtlaması aynı key içindir)
                // Ama sunucuyu yormamak adına ardışık yapıyoruz.

                // ykCargoKey null check (TS için)
                if (!order.ykCargoKey) continue;

                // Son sorgulama 1 dakikadan kısaysa atla (YK hatası almamak için)
                if (order.ykSyncedAt) {
                    const secondsSinceSync = (Date.now() - new Date(order.ykSyncedAt).getTime()) / 1000;
                    if (secondsSinceSync < 65) continue;
                }

                const result = await queryYKShipment(order.ykCargoKey, creds);
                
                if (result.success) {
                    let newOrderStatus: any = undefined;
                    if (result.operationStatus === "IND") {
                        newOrderStatus = "SHIPPED";
                    } else if (result.operationStatus === "DLV") {
                        newOrderStatus = "DELIVERED";
                        deliveredCount++;
                    } else if (result.operationStatus === "CNL" || result.operationStatus === "ISC" || result.operationStatus === "BI") {
                        newOrderStatus = "CANCELLED";
                    }

                    await prisma.order.update({
                        where: { id: order.id },
                        data: {
                            ykStatus: result.operationStatus ?? null,
                            ykStatusMessage: result.operationMessage ?? null,
                            ykDocId: result.docId ?? null,
                            ykSyncedAt: new Date(),
                            ...(result.trackingUrl ? { trackingUrl: result.trackingUrl } : {}),
                            ...(newOrderStatus ? { status: newOrderStatus } : {}),
                        }
                    });
                    updatedCount++;
                } else {
                    errorCount++;
                }
            } catch (err) {
                console.error(`[YK Bulk Sync] Error on order ${order.orderNumber}:`, err);
                errorCount++;
            }
        }

        revalidatePath("/admin/orders");
        return { 
            success: true, 
            count: updatedCount, 
            delivered: deliveredCount, 
            errors: errorCount,
            message: `${updatedCount} sipariş güncellendi. (${deliveredCount} teslim edildi)` 
        };
    } catch (error) {
        console.error("[YK] syncAllYKOrders error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Toplu senkronizasyon başarısız." };
    }
}

/**
 * YK entegrasyon konfigürasyonunu kaydeder (Admin Settings)
 */
export async function saveYurticiConfig(data: {
    username: string;
    password: string;
    customerCode?: string;
    unitCode?: string;
    demandNo?: string;
    isTestMode: boolean;
    isActive: boolean;
}) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== "ADMIN") throw new Error("Unauthorized");

        const existing = await prisma.yurticiKargoConfig.findFirst();
        if (existing) {
            await prisma.yurticiKargoConfig.update({
                where: { id: existing.id },
                data,
            });
        } else {
            await prisma.yurticiKargoConfig.create({ data });
        }

        revalidatePath("/admin/integrations/yurtici");
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Kayıt hatası" };
    }
}

/**
 * Birden fazla siparişi toplu olarak Yurtiçi Kargo'ya gönderir.
 */
export async function bulkSendOrdersToYurtici(orderIds: string[]) {
    try {
        const session = await auth();
        if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
            throw new Error("Unauthorized");
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        // YK kısıtlamaları ve güvenli işlem için seri (sequential) işleme
        for (const id of orderIds) {
            const res = await sendOrderToYurtici(id);
            if (res.success) {
                results.success++;
            } else {
                results.failed++;
                results.errors.push(`${id}: ${res.error}`);
            }
        }

        revalidatePath("/admin/orders");
        return { 
            success: true, 
            message: `${results.success} sipariş kargoya verildi. ${results.failed} hata oluştu.`,
            error: results.failed > 0 ? results.errors.join("\n") : undefined,
            details: results 
        };
    } catch (error) {
        console.error("[YK Bulk Send] error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Toplu gönderim başarısız." };
    }
}
