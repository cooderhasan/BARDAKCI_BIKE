"use server";
import { requireAdmin } from "@/lib/admin-guard";

import { prisma } from "@/lib/db";
import { safeRevalidatePath as revalidatePath } from "@/lib/safe-revalidate";
import { NesClient } from "@/services/nes/api";
import type { UblReceiverInfo, UblInvoiceOptions } from "@/services/nes/ubl-builder";
import { buildInvoiceLines } from "@/services/nes/invoice-lines";
import { todayDate } from "@/services/nes/ubl-builder";
import { getStoreSiteUrl } from "@/lib/site-urls";

// ============= CONFIG YÖNETIMI =============

export async function getNesConfig() {
    await requireAdmin();
    try {
        const config = await (prisma as any).nesEInvoiceConfig.findFirst();
        return { success: true, data: config };
    } catch (error) {
        return { success: false, error: "NES ayarları alınamadı" };
    }
}

export async function saveNesConfig(prevState: any, formData: FormData) {
    await requireAdmin();
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
        const defaultProfile = (formData.get("defaultProfile") as string) || "TEMELFATURA";
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
            defaultProfile,
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
    await requireAdmin();
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
    await requireAdmin();
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
                payment: true,
            },
        });

        if (!order) return { success: false, message: "Sipariş bulunamadı." };

        // Fatura zaten kesilmiş mi kontrol
        if ((order as any).invoiceNo) {
            let invoiceUrl = (order as any).invoiceUrl;
            const partyId = config.senderVkn || "25403236566";
            const uuid = (order as any).invoiceId || (invoiceUrl?.match(/pdf\/([a-f0-9-]+)/i)?.[1]);
            if (uuid && (!invoiceUrl || invoiceUrl.includes("bardakcibike.com.tr"))) {
                const nesDocType = "EArchiveInvoice";
                invoiceUrl = `https://belge.nes.com.tr/document?PartyIdentification=${partyId}&Uuid=${uuid}&DocumentType=${nesDocType}&PreviewType=PDF&fileName=${uuid}.pdf`;
                await prisma.order.update({
                    where: { id: orderId },
                    data: { invoiceUrl },
                });
            } else if (invoiceUrl?.includes("DocumentType=EInvoice&")) {
                // İlk e-Fatura'larda yanlış belge türüyle kaydedilen link (404) düzeltilir, pazaryerine doğrusu gider
                invoiceUrl = invoiceUrl.replace("DocumentType=EInvoice&", "DocumentType=OutgoingInvoice&");
                await prisma.order.update({ where: { id: orderId }, data: { invoiceUrl } });
            }

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
                    } else if (order.source === "PAZARAMA") {
                        const pzConfig = await (prisma as any).pazaramaConfig.findFirst({ where: { isActive: true } });
                        if (pzConfig) {
                            const { PazaramaClient } = await import("@/services/pazarama/api");
                            const pz = new PazaramaClient(pzConfig);
                            const pzOrderId = order.shipmentPackageId || order.orderNumber;
                            const pzFallback = order.shipmentPackageId ? order.orderNumber : undefined;
                            const pzResult = await pz.uploadInvoiceLink(pzOrderId, invoiceUrl, pzFallback);
                            if (pzResult.success) {
                                return { success: true, message: "Mevcut fatura linki Pazarama'ya başarıyla yeniden gönderildi ✅" };
                            }
                        }
                    } else if (order.source === "TRENDYOL") {
                        const { TrendyolClient } = await import("@/services/trendyol/api");
                        const ty = new TrendyolClient();
                        const packageId = order.shipmentPackageId || order.orderNumber;
                        await ty.deleteInvoiceLink(packageId).catch(() => {});
                        await ty.uploadInvoiceLink(packageId, invoiceUrl, (order as any).invoiceNo || undefined);
                        return { success: true, message: "Mevcut fatura linki Trendyol'a başarıyla yeniden gönderildi ✅" };
                    } else if (order.source === "IDEFIX") {
                        const idefixConfig = await (prisma as any).idefixConfig.findFirst({ where: { isActive: true } });
                        if (idefixConfig) {
                            const { IdefixClient } = await import("@/services/idefix/api");
                            const idx = new IdefixClient(idefixConfig);
                            let shipmentId = order.shipmentPackageId;
                            if (!shipmentId || shipmentId.startsWith("IDE")) {
                                try {
                                    const orderRes = await idx.getOrders({ orderNumber: order.orderNumber });
                                    const items = orderRes?.items || (Array.isArray(orderRes) ? orderRes : []);
                                    const found = items.find((i: any) => i.orderNumber === order.orderNumber || i.id || i.shipmentId);
                                    const realShipmentId = found?.shipmentId || found?.id;
                                    if (realShipmentId) {
                                        shipmentId = String(realShipmentId);
                                        await prisma.order.update({
                                            where: { id: order.id },
                                            data: { shipmentPackageId: shipmentId },
                                        });
                                    }
                                } catch (e: any) {
                                    console.warn("Idefix sevkiyat ID bulma uyarısı:", e.message);
                                }
                            }
                            if (!shipmentId) shipmentId = order.orderNumber;
                            await idx.sendInvoiceLink(shipmentId, invoiceUrl);
                            return { success: true, message: "Mevcut fatura linki İdefix'e başarıyla yeniden gönderildi ✅" };
                        }
                    } else if (order.source === "CICEKSEPETI") {
                        const csConfig = await (prisma as any).ciceksepetiConfig.findFirst({ where: { isActive: true } });
                        if (csConfig) {
                            const { CiceksepetiClient } = await import("@/services/ciceksepeti/api");
                            const cs = new CiceksepetiClient(csConfig);
                            const targetItemId = order.shipmentPackageId || order.orderNumber.replace(/^CS-/, "");
                            const csResult = await cs.uploadInvoiceLink(targetItemId, invoiceUrl);
                            if (csResult.success) {
                                return { success: true, message: "Mevcut fatura linki Çiçeksepeti'ye başarıyla yeniden gönderildi ✅" };
                            }
                        }
                    } else if (order.source === "PTTAVM" || order.source === "PTT") {
                        const { uploadInvoiceToPttavm } = await import("@/app/admin/(protected)/integrations/pttavm/actions");
                        const pttRes = await uploadInvoiceToPttavm(order.orderNumber, invoiceUrl);
                        if (pttRes.success) {
                            return { success: true, message: "Mevcut fatura linki ePttAVM'ye başarıyla yeniden gönderildi ✅" };
                        } else {
                            return { success: false, message: pttRes.message };
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
        const isRealTaxId = taxId && taxId !== "11111111111" && taxId !== "1111111111" && (taxId.length === 10 || taxId.length === 11);
        let useEInvoice = false;

        if (isRealTaxId) {
            try {
                const taxpayerCheck = await client.checkTaxpayer(taxId);
                useEInvoice = taxpayerCheck.isEInvoiceUser;
                if (useEInvoice && taxpayerCheck.alias) {
                    receiver.receiverAlias = taxpayerCheck.alias;
                }
                console.log(`🔍 Mükellef Sorgusu: VKN=${taxId} → ${useEInvoice ? `E-FATURA MÜKELLEFİ ✅ (alias: ${taxpayerCheck.alias})` : "E-FATURA MÜKELLEFİ DEĞİL → E-ARŞİV"}`);
            } catch (e: any) {
                // Mükellefse NES e-Arşiv'i zaten reddeder; mükellef değilse e-Arşiv doğru tür
                console.warn(`⚠️ Mükellef sorgusu başarısız, e-Arşiv olarak devam ediliyor: ${e?.message}`);
            }
        }

        // e-Fatura serisi NES'te tanımlı varsayılan seri (yoksa eski sabit "MFB")
        const eInvoicePrefix = useEInvoice ? await client.getEInvoiceSeriesPrefix() : null;

        // 8. Sipariş kaynağına göre bilgiler
        // Satışın yapıldığı site (internet satış bilgisi) ve pazaryerinde ödeme aracısı adı
        const marketplaceSites: Record<string, { url: string; name: string }> = {
            "TRENDYOL": { url: "https://www.trendyol.com", name: "Trendyol" },
            "N11": { url: "https://www.n11.com", name: "N11" },
            "HEPSIBURADA": { url: "https://www.hepsiburada.com", name: "Hepsiburada" },
            "IDEFIX": { url: "https://www.idefix.com", name: "Idefix" },
            "PAZARAMA": { url: "https://www.pazarama.com", name: "Pazarama" },
            "CICEKSEPETI": { url: "https://www.ciceksepeti.com", name: "Çiçeksepeti" },
            "PTTAVM": { url: "https://www.pttavm.com", name: "ePttAVM" },
            "PTT": { url: "https://www.pttavm.com", name: "ePttAVM" },
        };
        const cargoInfoMap: Record<string, { taxId: string; name: string }> = {
            "Aras Kargo": { taxId: "7200007379", name: "ARAS KARGO YURTİÇİ YURTDİŞI TAŞ. A.Ş." },
            "Aras": { taxId: "7200007379", name: "ARAS KARGO YURTİÇİ YURTDİŞI TAŞ. A.Ş." },
            "Sürat Kargo": { taxId: "7870233582", name: "SÜRAT KARGO TAŞ. VE DAĞ. HİZ. A.Ş." },
            "Sürat": { taxId: "7870233582", name: "SÜRAT KARGO TAŞ. VE DAĞ. HİZ. A.Ş." },
            "PTT Kargo": { taxId: "7320068060", name: "PTT A.Ş." },
            "PTT": { taxId: "7320068060", name: "PTT A.Ş." },
            "Trendyol Express": { taxId: "8590921777", name: "TRENDYOL LOJİSTİK A.Ş." },
            "HepsiJet": { taxId: "9060578745", name: "HEPSİJET LOJİSTİK A.Ş." },
            "MNG Kargo": { taxId: "6530413903", name: "MNG KARGO YURTİÇİ VE YURTDIŞI TAŞ. A.Ş." },
        };

        const source = order.source || "WEB";
        const cargoName = order.cargoCompany || "";

        // Pazaryeri ve sipariş verisine göre kargo firmasını dinamik belirle
        let cargoInfo = cargoName ? (cargoInfoMap[cargoName] || null) : null;
        if (!cargoInfo && cargoName) {
            const normalizedCargo = cargoName.toLowerCase();
            if (normalizedCargo.includes("aras")) cargoInfo = cargoInfoMap["Aras Kargo"];
            else if (normalizedCargo.includes("sürat") || normalizedCargo.includes("surat")) cargoInfo = cargoInfoMap["Sürat Kargo"];
            else if (normalizedCargo.includes("ptt")) cargoInfo = cargoInfoMap["PTT Kargo"];
            else if (normalizedCargo.includes("hepsi") || normalizedCargo.includes("jet")) cargoInfo = cargoInfoMap["HepsiJet"];
            else if (normalizedCargo.includes("trendyol") || normalizedCargo.includes("tex")) cargoInfo = cargoInfoMap["Trendyol Express"];
        }

        // Kargo ismi girilmemişse pazaryerine göre dinamik varsayılan seç
        if (!cargoInfo) {
            if (source === "PTTAVM" || source === "PTT") {
                cargoInfo = cargoInfoMap["PTT Kargo"];
            } else {
                cargoInfo = cargoInfoMap["Aras Kargo"];
            }
        }

        const marketplaceSite = marketplaceSites[source];
        // Site siparişinde mağazanın adresi (Moto Vitrin: MOTOR_SITE_URL; taşınınca kendiliğinden motovitrin.com)
        const purchaseUrl = marketplaceSite?.url || getStoreSiteUrl(order.store);
        const purchaseHost = purchaseUrl.replace(/^https?:\/\//, "");

        // Ödeme şekli: pazaryerinde ödemeyi pazaryeri alır (ödeme aracısı); sitede siparişin ödeme yöntemi
        const paymentMethod = (order as any).payment?.method;
        const webPayment: Record<string, { code: "10" | "30" | "48" | "97"; note: string }> = {
            CREDIT_CARD: { code: "48", note: "KREDIKARTI/BANKAKARTI" },
            BANK_TRANSFER: { code: "30", note: "EFT/HAVALE" },
            CASH_ON_DELIVERY: { code: "10", note: "KAPIDAODEME" },
            CURRENT_ACCOUNT: { code: "97", note: "DIGER – Cari Hesap" },
        };
        const paymentInfo = marketplaceSite
            ? { code: "1" as const, note: "ODEMEARACISI", channel: marketplaceSite.name }
            : webPayment[paymentMethod] || { code: "97" as const, note: "DIGER – Belirtilmemiş" };
        const paymentDate = todayDate(new Date((order as any).payment?.updatedAt || order.createdAt));
        const profileId = useEInvoice ? ((config.defaultProfile as any) || "TEMELFATURA") : "EARSIVFATURA";

        const invoiceOptions: Partial<UblInvoiceOptions> = {
            profileId,
            ...(eInvoicePrefix ? { prefix: eInvoicePrefix } : {}),
            invoiceTypeCode: "SATIS",
            orderNumber: order.orderNumber,
            carrier: cargoInfo,
            purchaseUrl,
            payment: { ...paymentInfo, date: paymentDate },
            // Faturayı kargolarken kesiyoruz; ayrı gönderim tarihi tutulmadığı için fatura günü yazılır
            despatchDate: todayDate(),
            notes: [
                `Sipariş No: ${order.orderNumber}`,
                `Kaynak: ${purchaseHost}`,
                cargoInfo?.name ? `Kargo Taşıyıcı: ${cargoInfo.name} (VKN: ${cargoInfo.taxId})` : "",
                "İRSALİYE YERİNE GEÇER",
            ].filter(Boolean),
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

        // 10. NES Doğrudan PDF URL'i oluştur (Pazaryerlerinde yeni sekmede direkt PDF açılması için)
        const partyId = config.senderVkn || "25403236566";
        // belge.nes.com.tr: e-Fatura için "OutgoingInvoice" ("EInvoice" 404 veriyor), e-Arşiv için "EArchiveInvoice"
        const nesDocType = useEInvoice ? "OutgoingInvoice" : "EArchiveInvoice";
        const pdfProxyUrl = `https://belge.nes.com.tr/document?PartyIdentification=${partyId}&Uuid=${result.uuid}&DocumentType=${nesDocType}&PreviewType=PDF&fileName=${result.uuid}.pdf`;

        // 11. DB'ye kaydet
        const invoiceNo = result.invoiceNumber || `NES-${order.orderNumber}`;
        await prisma.order.update({
            where: { id: orderId },
            data: {
                invoiceId: result.uuid || `nes-${Date.now()}`,
                invoiceNo,
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
                } else if (order.source === "TRENDYOL") {
                    const { TrendyolClient } = await import("@/services/trendyol/api");
                    const ty = new TrendyolClient();
                    const packageId = order.shipmentPackageId || order.orderNumber;
                    await ty.uploadInvoiceLink(packageId, pdfProxyUrl, invoiceNo || undefined);
                    marketplaceMessage = " | Trendyol'a fatura linki iletildi ✅";
                } else if (order.source === "IDEFIX") {
                    const idefixConfig = await (prisma as any).idefixConfig.findFirst({ where: { isActive: true } });
                    if (idefixConfig) {
                        const { IdefixClient } = await import("@/services/idefix/api");
                        const idx = new IdefixClient(idefixConfig);
                        let shipmentId = order.shipmentPackageId;
                        if (!shipmentId || shipmentId.startsWith("IDE")) {
                            try {
                                const orderRes = await idx.getOrders({ orderNumber: order.orderNumber });
                                const items = orderRes?.items || (Array.isArray(orderRes) ? orderRes : []);
                                const found = items.find((i: any) => i.orderNumber === order.orderNumber || i.id || i.shipmentId);
                                const realShipmentId = found?.shipmentId || found?.id;
                                if (realShipmentId) {
                                    shipmentId = String(realShipmentId);
                                    await prisma.order.update({
                                        where: { id: order.id },
                                        data: { shipmentPackageId: shipmentId },
                                    });
                                }
                            } catch (e: any) {
                                console.warn("Idefix sevkiyat ID bulma uyarısı:", e.message);
                            }
                        }
                        if (!shipmentId) shipmentId = order.orderNumber;
                        await idx.sendInvoiceLink(shipmentId, pdfProxyUrl);
                        marketplaceMessage = " | İdefix'e fatura linki iletildi ✅";
                    }
                } else if (order.source === "PAZARAMA") {
                    const pzConfig = await (prisma as any).pazaramaConfig.findFirst({ where: { isActive: true } });
                    if (pzConfig) {
                        const { PazaramaClient } = await import("@/services/pazarama/api");
                        const pz = new PazaramaClient(pzConfig);
                        const pzOrderId = order.shipmentPackageId || order.orderNumber;
                        const pzFallback = order.shipmentPackageId ? order.orderNumber : undefined;
                        const pzResult = await pz.uploadInvoiceLink(pzOrderId, pdfProxyUrl, pzFallback);
                        if (pzResult.success) {
                            marketplaceMessage = " | Pazarama'ya fatura linki iletildi ✅";
                        } else {
                            marketplaceMessage = ` | Pazarama fatura hatası: ${pzResult.message}`;
                        }
                    }
                } else if (order.source === "CICEKSEPETI") {
                    const csConfig = await (prisma as any).ciceksepetiConfig.findFirst({ where: { isActive: true } });
                    if (csConfig) {
                        const { CiceksepetiClient } = await import("@/services/ciceksepeti/api");
                        const cs = new CiceksepetiClient(csConfig);
                        const targetItemId = order.shipmentPackageId || order.orderNumber.replace(/^CS-/, "");
                        const csResult = await cs.uploadInvoiceLink(targetItemId, pdfProxyUrl);
                        if (csResult.success) {
                            marketplaceMessage = " | Çiçeksepeti'ye fatura linki iletildi ✅";
                        } else {
                            marketplaceMessage = ` | Çiçeksepeti fatura hatası: ${csResult.message}`;
                        }
                    }
                } else if (order.source === "PTTAVM" || order.source === "PTT") {
                    const { uploadInvoiceToPttavm } = await import("@/app/admin/(protected)/integrations/pttavm/actions");
                    const pttRes = await uploadInvoiceToPttavm(order.orderNumber, pdfProxyUrl);
                    if (pttRes.success) {
                        marketplaceMessage = " | ePttAVM'ye fatura linki iletildi ✅";
                    } else {
                        marketplaceMessage = ` | ePttAVM fatura hatası: ${pttRes.message}`;
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

    // VKN/TCKN: siparişte müşterinin girdiği öncelikli, yoksa üyelikteki
    if (shippingAddress?.taxNumber) vkn = String(shippingAddress.taxNumber);
    else if (user?.taxNumber) vkn = user.taxNumber;

    // Pazaryeri siparişlerinde (ör. PttAVM) fatura bilgileri adreste: firma ünvanı, vergi dairesi, fatura adresi
    if (shippingAddress?.taxOffice) taxOffice = String(shippingAddress.taxOffice).trim();

    // Şirket ise
    const companyName = String(shippingAddress?.companyName || "").trim() || user?.companyName;
    if (companyName) {
        title = companyName;
        name = companyName;
    }

    // Bireysel müşteri
    const fullName = shippingAddress?.billingFullName || shippingAddress?.fullName || shippingAddress?.name || user?.name || "";
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
        address: shippingAddress?.billingAddressText || shippingAddress?.address || shippingAddress?.addressText || user?.address || ".",
        city: shippingAddress?.billingCity || shippingAddress?.city || user?.city || "ISTANBUL",
        district: shippingAddress?.billingDistrict || shippingAddress?.district || user?.district || "Merkez",
        country: "Turkiye",
        email: user?.email || order.guestEmail || "",
        taxOffice: taxOffice || undefined,
    };
}

/**
 * Hatalı/iptal edilmiş bir faturanın sipariş üzerindeki kaydını temizler
 * Böylece NES üzerinden iptal edilen faturanın yerine sistemden tekrar doğru fatura kesilebilir.
 */
export async function resetOrderInvoice(orderId: string) {
    await requireAdmin();
    try {
        await prisma.order.update({
            where: { id: orderId },
            data: {
                invoiceNo: null,
                invoiceId: null,
                invoiceUrl: null,
            },
        });
        revalidatePath("/admin/orders");
        return { success: true, message: "Fatura kaydı siparişten temizlendi. Artık tekrar fatura kesebilirsiniz." };
    } catch (error: any) {
        return { success: false, message: "Fatura sıfırlanamadı: " + error.message };
    }
}

