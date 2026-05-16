"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
    TrendyolEFaturamClient,
    EArchiveInvoiceData,
    InvoiceLine,
} from "@/services/trendyol-efaturam/api";

export async function getEFaturamConfig() {
    try {
        const config = await (prisma as any).trendyolEFaturamConfig.findFirst();
        return { success: true, data: config };
    } catch (error) {
        return { success: false, error: "Ayarlar alınamadı" };
    }
}

export async function saveEFaturamConfig(prevState: any, formData: FormData) {
    try {
        const username = formData.get("username") as string;
        const password = formData.get("password") as string;
        const companyId = formData.get("companyId") as string;
        const earchivePrefix = (formData.get("earchivePrefix") as string) || "";
        const efaturaPrefix = (formData.get("efaturaPrefix") as string) || "";
        const isActive = formData.get("isActive") === "on";
        const isTestMode = formData.get("isTestMode") === "on";

        if (!username || !password) {
            return { success: false, message: "Kullanıcı adı ve şifre zorunludur." };
        }

        const existing = await (prisma as any).trendyolEFaturamConfig.findFirst();

        if (existing) {
            await (prisma as any).trendyolEFaturamConfig.update({
                where: { id: existing.id },
                data: { username, password, companyId, earchivePrefix, efaturaPrefix, isActive, isTestMode },
            });
        } else {
            await (prisma as any).trendyolEFaturamConfig.create({
                data: { username, password, companyId, earchivePrefix, efaturaPrefix, isActive, isTestMode },
            });
        }

        revalidatePath("/admin/integrations/trendyol-efaturam");
        return { success: true, message: "Trendyol e-Faturam ayarları başarıyla kaydedildi." };
    } catch (error) {
        return { success: false, message: "Kaydetme hatası." };
    }
}

export async function testEFaturamConnection() {
    try {
        const config = await (prisma as any).trendyolEFaturamConfig.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif ayar bulunamadı. Önce ayarları kaydedin ve 'Aktif' yapın." };

        const client = new TrendyolEFaturamClient({
            username: config.username,
            password: config.password,
            companyId: config.companyId,
            earchivePrefix: config.earchivePrefix,
            efaturaPrefix: config.efaturaPrefix,
            isTestMode: config.isTestMode,
        });

        const result = await client.testConnection();
        return result;
    } catch (error: any) {
        return { success: false, message: "Sistem Hatası: " + error.message };
    }
}

export async function testEFaturamPrefixes() {
    try {
        const config = await (prisma as any).trendyolEFaturamConfig.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif ayar bulunamadı." };

        const client = new TrendyolEFaturamClient({
            username: config.username,
            password: config.password,
            companyId: config.companyId,
            earchivePrefix: config.earchivePrefix,
            efaturaPrefix: config.efaturaPrefix,
            isTestMode: config.isTestMode,
        });

        const prefix = await client.getAvailablePrefixes();
        const debug = await client.getDebugInfo();
        
        return { 
            success: true, 
            message: prefix ? `Kullanılabilir Prefix: ${prefix}` : "Prefix bulunamadı, varsayılan (DAP) denenecek.",
            debug
        };
    } catch (error: any) {
        return { success: false, message: "Hata: " + error.message };
    }
}

/**
 * Sipariş verisinden e-Arşiv fatura payload'u oluşturur
 */
function buildInvoicePayload(order: any): EArchiveInvoiceData {
    const shippingAddress = order.shippingAddress as any;
    const user = order.user;

    // Alıcı adı belirleme
    let receiverName = "";
    let receiverSurname = "";
    let receiverTitle = "";
    let receiverTaxId = "11111111111"; // Varsayılan (nihai tüketici)
    let receiverTaxOffice = "";

    // Kullanıcıdan VKN/TCKN al
    if (user?.taxNumber) {
        receiverTaxId = user.taxNumber;
    }

    // Şirket ise
    if (user?.companyName) {
        receiverTitle = user.companyName;
        receiverName = user.companyName;
    }

    // Bireysel müşteri
    const fullName = shippingAddress?.fullName || shippingAddress?.name || user?.name || "";
    if (fullName) {
        const nameParts = fullName.trim().split(" ");
        receiverName = nameParts.slice(0, -1).join(" ") || fullName;
        receiverSurname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
    }

    // Fatura kalemlerini oluştur
    const invoiceLines: InvoiceLine[] = order.items.map((item: any) => {
        const unitPriceInclTax = Number(item.unitPrice); // KDV DAHİL fiyat
        const quantity = item.quantity;
        const vatRate = item.vatRate || 20;
        const discountRate = Number(item.discountRate || 0);
        
        // KDV dahil fiyattan KDV hariç fiyatı hesapla
        const discountedPriceInclTax = unitPriceInclTax * (1 - discountRate / 100);
        const lineTotalInclTax = discountedPriceInclTax * quantity;
        const lineTotalExclTax = lineTotalInclTax / (1 + vatRate / 100); // KDV hariç
        const lineTax = lineTotalInclTax - lineTotalExclTax; // KDV tutarı
        const unitPriceExclTax = unitPriceInclTax / (1 + vatRate / 100);
        const lineDiscount = (unitPriceInclTax * quantity) - lineTotalInclTax;

        return {
            name: item.productName || item.product?.name || "Ürün",
            quantity: quantity,
            unitCode: "C62", // Adet
            unitPrice: Math.round(unitPriceExclTax * 100) / 100, // KDV hariç birim fiyat
            taxRate: vatRate,
            taxAmount: Math.round(lineTax * 100) / 100,
            amount: Math.round(lineTotalExclTax * 100) / 100, // KDV hariç toplam
            discountAmount: Math.round(lineDiscount * 100) / 100,
        };
    });

    // Toplamları hesapla
    const taxExcludedPrice = invoiceLines.reduce((sum, line) => sum + line.amount, 0);
    const taxAmount = invoiceLines.reduce((sum, line) => sum + line.taxAmount, 0);
    const totalDiscount = invoiceLines.reduce((sum, line) => sum + (line.discountAmount || 0), 0);
    const taxInclusiveAmount = taxExcludedPrice + taxAmount;

    // Kargo tutarını ekle
    const shippingCost = Number(order.shippingCost || 0);
    if (shippingCost > 0) {
        const shippingTaxRate = 20; // Kargo KDV oranı
        const shippingTax = shippingCost * (shippingTaxRate / 100);
        invoiceLines.push({
            name: "Kargo Ücreti",
            quantity: 1,
            unitCode: "C62",
            unitPrice: shippingCost,
            taxRate: shippingTaxRate,
            taxAmount: Math.round(shippingTax * 100) / 100,
            amount: shippingCost,
        });
    }

    // Final toplamlar (kargo dahil)
    const finalTaxExcluded = invoiceLines.reduce((sum, line) => sum + line.amount, 0);
    const finalTaxAmount = invoiceLines.reduce((sum, line) => sum + line.taxAmount, 0);
    const finalTaxInclusive = finalTaxExcluded + finalTaxAmount;

    return {
        scenario: "EARSIVFATURA",
        invoiceTypeCode: "SATIS",
        currency: "TRY",
        localReferenceId: order.orderNumber,
        receiverName,
        receiverSurname,
        receiverTitle: receiverTitle || undefined,
        receiverTaxId,
        receiverTaxOffice: receiverTaxOffice || undefined,
        receiverAddress: shippingAddress?.address || user?.address || undefined,
        receiverCity: shippingAddress?.city || user?.city || undefined,
        receiverDistrict: shippingAddress?.district || user?.district || undefined,
        receiverCountry: "Türkiye",
        receiverEmail: user?.email || order.guestEmail || undefined,
        taxExcludedPrice: Math.round(finalTaxExcluded * 100) / 100,
        taxAmount: Math.round(finalTaxAmount * 100) / 100,
        taxInclusiveAmount: Math.round(finalTaxInclusive * 100) / 100,
        payableAmount: Math.round(finalTaxInclusive * 100) / 100,
        discountAmount: totalDiscount > 0 ? Math.round(totalDiscount * 100) / 100 : undefined,
        invoiceLines,
        notes: [`Sipariş No: ${order.orderNumber}`],
        issuedAt: new Date().toISOString(),
    };
}

export async function sendOrderInvoice(orderId: string) {
    try {
        // 1. Config kontrolü
        const config = await (prisma as any).trendyolEFaturamConfig.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Trendyol e-Faturam entegrasyonu aktif değil. Ayarlardan aktifleştirin." };

        // 2. Sipariş kontrolü
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: { include: { product: true } },
                user: true,
            },
        });

        if (!order) return { success: false, message: "Sipariş bulunamadı." };
        if ((order as any).invoiceNo) return { success: false, message: `Bu sipariş için zaten fatura kesilmiş: ${(order as any).invoiceNo}` };

        // 3. Gerekli bilgi kontrolü
        const shippingAddr = order.shippingAddress as any;
        if (!shippingAddr?.fullName && !shippingAddr?.name && !order.user?.name && !order.user?.companyName) {
            return { success: false, message: "Fatura kesilebilmesi için müşteri adı gereklidir." };
        }

        // 4. E-Faturam client oluştur
        const client = new TrendyolEFaturamClient({
            username: config.username,
            password: config.password,
            companyId: config.companyId,
            earchivePrefix: config.earchivePrefix,
            efaturaPrefix: config.efaturaPrefix,
            isTestMode: config.isTestMode,
        });

        // 5. Fatura payload'unu oluştur
        const invoicePayload = buildInvoicePayload(order);

        console.log(`📡 E-Fatura gönderiliyor: Sipariş #${order.orderNumber}`);
        console.log(`   Mod: ${config.isTestMode ? "TEST" : "CANLI"}`);
        console.log(`   Alıcı: ${invoicePayload.receiverName} ${invoicePayload.receiverSurname || ""}`);
        console.log(`   VKN/TCKN: ${invoicePayload.receiverTaxId}`);
        console.log(`   Toplam: ${invoicePayload.payableAmount} TL`);

        // 6. Fatura gönder (e-Arşiv olarak)
        const result = await client.createEArchiveInvoice(invoicePayload);

        // 7. Sonucu DB'ye kaydet
        const invoiceId = result?.id || result?.invoiceId || result?.uuid || result?.invoiceUuid || null;
        const invoiceNo = result?.invoiceNumber || result?.invoiceNo || result?.documentNumber || null;
        const invoiceUrl = result?.pdfUrl || result?.pdfLink || result?.url || null;

        await prisma.order.update({
            where: { id: orderId },
            data: {
                invoiceId: invoiceId?.toString() || `efat-${Date.now()}`,
                invoiceNo: invoiceNo || `${config.isTestMode ? "TEST" : "INV"}-${order.orderNumber}`,
                invoiceStatus: "SENT",
                invoiceUrl: invoiceUrl || null,
            },
        });

        // 8. Pazaryeri siparişi ise fatura linkini otomatik gönder
        let marketplaceMessage = "";
        if (invoiceUrl && order.source !== "WEB") {
            try {
                if (order.source === "N11") {
                    const { N11Client } = await import("@/services/n11/api");
                    const n11 = new N11Client();
                    const n11Result = await n11.uploadInvoiceLink(order.orderNumber, invoiceUrl);
                    if (n11Result.success) {
                        marketplaceMessage = " | N11'e fatura linki iletildi ✅";
                    } else {
                        marketplaceMessage = ` | N11 fatura hatası: ${n11Result.message}`;
                    }
                } else if (order.source === "HEPSIBURADA") {
                    // HB canlıya geçince aktif olacak
                    // const { HepsiburadaClient } = await import("@/services/hepsiburada/api");
                    // const hb = new HepsiburadaClient();
                    // await hb.uploadInvoiceLink(packageNumber, invoiceUrl, order.orderNumber);
                    marketplaceMessage = " | HB fatura linki (canlı ortamda otomatik gönderilecek)";
                }
            } catch (mpError: any) {
                console.error(`⚠️ Pazaryeri fatura link hatası (${order.source}):`, mpError.message);
                marketplaceMessage = ` | ${order.source} fatura link hatası: ${mpError.message}`;
            }
        }

        revalidatePath("/admin/orders");

        const modeLabel = config.isTestMode ? " (Test Modu)" : "";
        return {
            success: true,
            message: `✅ Fatura başarıyla gönderildi${modeLabel}! ${invoiceNo ? `Fatura No: ${invoiceNo}` : ""}${marketplaceMessage}`,
        };
    } catch (error: any) {
        console.error("❌ Fatura gönderim hatası:", error.message);

        // Hata durumunu da kaydet
        try {
            await prisma.order.update({
                where: { id: orderId },
                data: {
                    invoiceStatus: "ERROR",
                },
            });
        } catch (e) {
            // DB güncelleme hatası ignore
        }

        return {
            success: false,
            message: `Fatura hatası: ${error.message}`,
        };
    }
}
