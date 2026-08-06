"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { NesClient } from "@/services/nes/api";
import type { UblReceiverInfo, UblInvoiceLine, UblInvoiceOptions } from "@/services/nes/ubl-builder";

// ============= CONFIG YÖNETIMI =============

export async function getNesConfig() {
    try {
        const config = await (prisma as any).nesEInvoiceConfig.findFirst();
        return { success: true, data: config };
    } catch (error) {
        return { success: false, error: "NES ayarları alınamadı" };
    }
}

export async function saveNesConfig(prevState: any, formData: FormData) {
    try {
        const apiKey = formData.get("apiKey") as string;
        const senderAlias = formData.get("senderAlias") as string;
        const senderVkn = formData.get("senderVkn") as string;
        const senderTitle = formData.get("senderTitle") as string;
        const senderAddress = (formData.get("senderAddress") as string) || "";
        const senderCity = (formData.get("senderCity") as string) || "İSTANBUL";
        const senderDistrict = (formData.get("senderDistrict") as string) || "";
        const taxOffice = (formData.get("taxOffice") as string) || "";
        const sourceApp = (formData.get("sourceApp") as string) || "BardakciBike";
        const isActive = formData.get("isActive") === "on";
        const isTestMode = formData.get("isTestMode") === "on";

        if (!apiKey || !senderVkn || !senderTitle) {
            return { success: false, message: "API Anahtarı, VKN/TCKN ve Ünvan zorunludur." };
        }

        if (senderVkn.length !== 10 && senderVkn.length !== 11) {
            return { success: false, message: "VKN 10 haneli (Şirket) veya TCKN 11 haneli (Şahıs) olmalıdır." };
        }

        const existing = await (prisma as any).nesEInvoiceConfig.findFirst();

        const data = {
            apiKey,
            senderAlias: senderAlias || "urn:mail:defaultgb@nes.com.tr",
            senderVkn,
            senderTitle,
            senderAddress,
            senderCity,
            senderDistrict,
            taxOffice,
            sourceApp,
            isActive,
            isTestMode,
        };

        if (existing) {
            await (prisma as any).nesEInvoiceConfig.update({
                where: { id: existing.id },
                data,
            });
        } else {
            await (prisma as any).nesEInvoiceConfig.create({ data });
        }

        revalidatePath("/admin/integrations/nes-efatura");
        return { success: true, message: "NES E-Fatura ayarları başarıyla kaydedildi. ✅" };
    } catch (error: any) {
        return { success: false, message: "Kaydetme hatası: " + error.message };
    }
}

export async function testNesConnection() {
    try {
        const config = await (prisma as any).nesEInvoiceConfig.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif NES ayarı bulunamadı. Önce ayarları kaydedin ve 'Aktif' yapın." };

        const client = new NesClient({
            apiKey: config.apiKey,
            senderAlias: config.senderAlias,
            senderVkn: config.senderVkn,
            senderTitle: config.senderTitle,
            senderAddress: config.senderAddress,
            senderCity: config.senderCity,
            senderDistrict: config.senderDistrict,
            taxOffice: config.taxOffice,
            sourceApp: config.sourceApp,
            isTestMode: config.isTestMode,
        });

        return await client.testConnection();
    } catch (error: any) {
        return { success: false, message: "Sistem Hatası: " + error.message };
    }
}

// ============= SİPARİŞ FATURA GÖNDERİM =============

/**
 * Sipariş verisinden NES API'ye e-Fatura veya e-Arşiv fatura gönderir
 */
export async function sendOrderInvoiceNes(orderId: string) {
    try {
        // 1. NES Config kontrolü
        const config = await (prisma as any).nesEInvoiceConfig.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "NES E-Fatura entegrasyonu aktif değil. Ayarlardan aktifleştirin." };

        // 2. Sipariş kontrolü
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: { include: { product: true } },
                user: true,
            },
        });

        if (!order) return { success: false, message: "Sipariş bulunamadı." };

        // Fatura zaten kesilmiş mi kontrol
        if ((order as any).invoiceNo) {
            let invoiceUrl = (order as any).invoiceUrl;

            // Pazaryerine link yeniden gönder
            if (order.source !== "WEB" && invoiceUrl) {
                try {
                    if (order.source === "HEPSIBURADA") {
                        const hbConfig = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
                        if (hbConfig) {
                            const { HepsiburadaClient } = await import("@/services/hepsiburada/api");
                            const hb = new HepsiburadaClient({
                                username: hbConfig.username,
                                password: hbConfig.password,
                                merchantId: hbConfig.merchantId,
                                isTestMode: hbConfig.isTestMode ?? false,
                            });
                            const packageId = order.shipmentPackageId || order.orderNumber;
                            await hb.uploadInvoiceLink(packageId, invoiceUrl, order.orderNumber);
                            return { success: true, message: "Mevcut fatura linki Hepsiburada'ya başarıyla yeniden gönderildi ✅" };
                        }
                    } else if (order.source === "N11") {
                        const { N11Client } = await import("@/services/n11/api");
                        const n11 = new N11Client();
                        const n11Result = await n11.uploadInvoiceLink(order.orderNumber, invoiceUrl);
                        if (n11Result.success) {
                            return { success: true, message: "Mevcut fatura linki N11'e başarıyla yeniden gönderildi ✅" };
                        }
                    }
                } catch (mpError: any) {
                    return { success: false, message: `Fatura zaten kesilmişti. Pazaryerine yeniden gönderim hatası: ${mpError.message}` };
                }
            }

            return { success: false, message: `Bu sipariş için zaten fatura kesilmiş: ${(order as any).invoiceNo}` };
        }

        // 3. Gerekli bilgi kontrolü
        const shippingAddr = order.shippingAddress as any;
        if (!shippingAddr?.fullName && !shippingAddr?.name && !order.user?.name && !order.user?.companyName) {
            return { success: false, message: "Fatura kesilebilmesi için müşteri adı gereklidir." };
        }

        // 4. NES Client oluştur
        const client = new NesClient({
            apiKey: config.apiKey,
            senderAlias: config.senderAlias,
            senderVkn: config.senderVkn,
            senderTitle: config.senderTitle,
            senderAddress: config.senderAddress,
            senderCity: config.senderCity,
            senderDistrict: config.senderDistrict,
            taxOffice: config.taxOffice,
            sourceApp: config.sourceApp,
            isTestMode: config.isTestMode,
        });

        // 5. Alıcı bilgilerini oluştur
        const receiver = buildReceiverInfo(order);

        // 6. Fatura kalemlerini oluştur
        const invoiceLines = buildInvoiceLines(order);

        // 7. Alıcının e-Fatura mükellefi olup olmadığını kontrol et
        const taxId = receiver.vkn;
        const isRealTaxId = taxId && taxId !== "11111111111" && taxId.length === 10;
        let useEInvoice = false;

        if (isRealTaxId) {
            try {
                const taxpayerCheck = await client.checkTaxpayer(taxId);
                useEInvoice = taxpayerCheck.isEInvoiceUser;
                if (useEInvoice && taxpayerCheck.alias) {
                    receiver.receiverAlias = taxpayerCheck.alias;
                }
                console.log(`🔍 Mükellef Sorgusu: VKN=${taxId} → ${useEInvoice ? `E-FATURA MÜKELLEFİ ✅ (alias: ${taxpayerCheck.alias})` : "E-FATURA MÜKELLEFİ DEĞİL → E-ARŞİV"}`);
            } catch (e) {
                console.warn(`⚠️ Mükellef sorgusu başarısız, e-Arşiv olarak devam ediliyor.`);
            }
        }

        // 8. Sipariş kaynağına göre bilgiler
        const purchaseUrlMap: Record<string, string> = {
            "WEB": "https://www.bardakcibike.com.tr",
            "TRENDYOL": "https://www.trendyol.com",
            "N11": "https://www.n11.com",
            "HEPSIBURADA": "https://www.hepsiburada.com",
        };
        const cargoInfoMap: Record<string, { taxId: string; name: string }> = {
            "Yurtiçi Kargo": { taxId: "3130557323", name: "YURTİÇİ KARGO SERVİSİ A.Ş." },
            "DHL ecommerce": { taxId: "6080712084", name: "DHL WORLDWIDE EXPRESS TAŞ. VE TİC. A.Ş." },
            "DHL": { taxId: "6080712084", name: "DHL WORLDWIDE EXPRESS TAŞ. VE TİC. A.Ş." },
            "Aras Kargo": { taxId: "7200007379", name: "ARAS KARGO YURTİÇİ YURTDİŞI TAŞ. A.Ş." },
            "MNG Kargo": { taxId: "6530413903", name: "MNG KARGO YURTİÇİ VE YURTDIŞI TAŞ. A.Ş." },
            "Sürat Kargo": { taxId: "7870233582", name: "SÜRAT KARGO TAŞ. VE DAĞ. HİZ. A.Ş." },
            "PTT Kargo": { taxId: "7320068060", name: "PTT A.Ş." },
            "Trendyol Express": { taxId: "8590921777", name: "TRENDYOL LOJİSTİK A.Ş." },
            "HepsiJet": { taxId: "9060578745", name: "HEPSİJET LOJİSTİK A.Ş." },
        };

        const source = order.source || "WEB";
        const cargoName = order.cargoCompany || "";
        const cargoInfo = cargoInfoMap[cargoName] || { taxId: "3130557323", name: "YURTİÇİ KARGO SERVİSİ A.Ş." };
        const purchaseUrl = purchaseUrlMap[source] || "https://www.bardakcibike.com.tr";

        const invoiceOptions: Partial<UblInvoiceOptions> = {
            invoiceTypeCode: "SATIS",
            orderNumber: order.orderNumber,
            carrier: cargoInfo,
            purchaseUrl,
            notes: [`Sipariş No: ${order.orderNumber}`, `Kaynak: ${source}`],
        };

        const invoiceType = useEInvoice ? "e-Fatura" : "e-Arşiv";
        console.log(`📡 NES ${invoiceType} gönderiliyor: Sipariş #${order.orderNumber}`);
        console.log(`   Mod: ${config.isTestMode ? "TEST" : "CANLI"}`);
        console.log(`   Alıcı: ${receiver.name} ${receiver.surname || ""}`);
        console.log(`   VKN/TCKN: ${receiver.vkn}`);
        console.log(`   Tür: ${invoiceType}`);

        // 9. Fatura gönder
        const result = useEInvoice
            ? await client.createEInvoice(receiver, invoiceLines, invoiceOptions)
            : await client.createEArchiveInvoice(receiver, invoiceLines, invoiceOptions);

        // 10. PDF Proxy URL'i oluştur
        const documentType = useEInvoice ? "einvoice" : "earchive";
        const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";
        const pdfProxyUrl = `${siteUrl}/api/invoices/pdf/${result.uuid}?type=${documentType}`;


        // 11. DB'ye kaydet
        await prisma.order.update({
            where: { id: orderId },
            data: {
                invoiceId: result.uuid || `nes-${Date.now()}`,
                invoiceNo: result.invoiceNumber || `NES-${order.orderNumber}`,
                invoiceStatus: "SENT",
                invoiceUrl: pdfProxyUrl,
            },
        });

        // 12. Pazaryeri fatura linki gönder
        let marketplaceMessage = "";
        if (order.source !== "WEB" && pdfProxyUrl) {
            try {
                if (order.source === "N11") {
                    const { N11Client } = await import("@/services/n11/api");
                    const n11 = new N11Client();
                    const n11Result = await n11.uploadInvoiceLink(order.orderNumber, pdfProxyUrl);
                    if (n11Result.success) {
                        marketplaceMessage = " | N11'e fatura linki iletildi ✅";
                    } else {
                        marketplaceMessage = ` | N11 fatura hatası: ${n11Result.message}`;
                    }
                } else if (order.source === "HEPSIBURADA") {
                    const hbConfig = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
                    if (hbConfig) {
                        const { HepsiburadaClient } = await import("@/services/hepsiburada/api");
                        const hb = new HepsiburadaClient({
                            username: hbConfig.username,
                            password: hbConfig.password,
                            merchantId: hbConfig.merchantId,
                            isTestMode: hbConfig.isTestMode ?? false,
                        });
                        const packageId = order.shipmentPackageId || order.orderNumber;
                        await hb.uploadInvoiceLink(packageId, pdfProxyUrl, order.orderNumber);
                        marketplaceMessage = " | HB'ye fatura linki iletildi ✅";
                    }
                }
            } catch (mpError: any) {
                console.error(`⚠️ Pazaryeri fatura link hatası (${order.source}):`, mpError.message);
                marketplaceMessage = ` | ${order.source} fatura link hatası: ${mpError.message}`;
            }
        }

        // 13. Müşteriye e-posta gönder
        let emailMessage = "";
        const customerEmail = order.guestEmail || order.user?.email;
        const customerName = shippingAddr?.fullName || shippingAddr?.name || order.user?.name || "Müşteri";

        if (pdfProxyUrl && customerEmail) {
            try {
                const { sendInvoiceNotificationEmail } = await import("@/lib/email");
                await sendInvoiceNotificationEmail({
                    to: customerEmail,
                    orderNumber: order.orderNumber,
                    customerName,
                    invoiceNo: result.invoiceNumber || `NES-${order.orderNumber}`,
                    invoiceUrl: pdfProxyUrl,
                    totalAmount: Number(order.total),
                });
                emailMessage = " | Fatura e-postası gönderildi 📧";
            } catch (emailErr: any) {
                console.warn("⚠️ Fatura e-postası gönderilemedi:", emailErr.message);
                emailMessage = ` | Mail hatası: ${emailErr.message}`;
            }
        } else if (!pdfProxyUrl) {
            emailMessage = " | PDF linki oluşturulamadı";
        } else if (!customerEmail) {
            emailMessage = " | Müşteri e-postası yok";
        }

        revalidatePath("/admin/orders");

        const modeLabel = config.isTestMode ? " (Test Modu)" : "";
        return {
            success: true,
            message: `✅ ${invoiceType} başarıyla gönderildi${modeLabel}! Fatura No: ${result.invoiceNumber}${marketplaceMessage}${emailMessage}`,
        };
    } catch (error: any) {
        console.error("❌ NES Fatura gönderim hatası:", error.message);

        // Hata durumunu kaydet
        try {
            await prisma.order.update({
                where: { id: orderId },
                data: { invoiceStatus: "ERROR" },
            });
        } catch (e) {
            // ignore
        }

        return {
            success: false,
            message: `Fatura hatası: ${error.message}`,
        };
    }
}

// ============= YARDIMCI FONKSİYONLAR =============

function buildReceiverInfo(order: any): UblReceiverInfo {
    const shippingAddress = order.shippingAddress as any;
    const user = order.user;

    let name = "";
    let surname = "";
    let title = "";
    let vkn = "11111111111"; // Varsayılan (nihai tüketici)
    let taxOffice = "";

    // VKN/TCKN
    if (user?.taxNumber) vkn = user.taxNumber;

    // Şirket ise
    if (user?.companyName) {
        title = user.companyName;
        name = user.companyName;
    }

    // Bireysel müşteri
    const fullName = shippingAddress?.fullName || shippingAddress?.name || user?.name || "";
    if (fullName) {
        const nameParts = fullName.trim().split(" ");
        name = nameParts.slice(0, -1).join(" ") || fullName;
        surname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
    }

    return {
        vkn: (vkn && vkn.trim().length >= 10) ? vkn.trim() : "11111111111",
        name: name || "Müşteri",
        surname: surname || ".",
        title: title || `${name} ${surname}`.trim() || "Müşteri",
        address: shippingAddress?.address || user?.address || ".",
        city: shippingAddress?.city || user?.city || "ISTANBUL",
        district: shippingAddress?.district || user?.district || "Merkez",
        country: "Turkiye",
        email: user?.email || order.guestEmail || "",
        taxOffice: taxOffice || undefined,
    };
}

function buildInvoiceLines(order: any): UblInvoiceLine[] {
    const lines: UblInvoiceLine[] = order.items.map((item: any) => {
        const unitPriceInclTax = Number(item.unitPrice);
        const quantity = item.quantity;
        const vatRate = item.vatRate || 20;
        const discountRate = Number(item.discountRate || 0);

        // KDV dahil fiyattan KDV hariç fiyatı hesapla
        const discountedPriceInclTax = unitPriceInclTax * (1 - discountRate / 100);
        const lineTotalInclTax = discountedPriceInclTax * quantity;
        const lineTotalExclTax = lineTotalInclTax / (1 + vatRate / 100);
        const unitPriceExclTax = unitPriceInclTax / (1 + vatRate / 100);
        const lineDiscount = (unitPriceInclTax * quantity) - lineTotalInclTax;

        return {
            name: item.productName || item.product?.name || "Ürün",
            quantity,
            unitCode: "C62",
            unitPrice: Math.round(unitPriceExclTax * 100) / 100,
            taxRate: vatRate,
            discountAmount: lineDiscount > 0.01 ? Math.round(lineDiscount * 100) / 100 : undefined,
        };
    });

    // Kargo ücreti ekle
    const shippingCost = Number(order.shippingCost || 0);
    if (shippingCost > 0) {
        lines.push({
            name: "Kargo Ücreti",
            quantity: 1,
            unitCode: "C62",
            unitPrice: shippingCost,
            taxRate: 20,
        });
    }

    return lines;
}
