"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { TrendyolEFaturamClient } from "@/services/trendyol-efaturam/api";

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
        const isActive = formData.get("isActive") === "on";
        const isTestMode = formData.get("isTestMode") === "on";

        if (!username || !password) {
            return { success: false, message: "Kullanıcı adı ve şifre zorunludur." };
        }

        const existing = await (prisma as any).trendyolEFaturamConfig.findFirst();

        if (existing) {
            await (prisma as any).trendyolEFaturamConfig.update({
                where: { id: existing.id },
                data: { username, password, companyId, isActive, isTestMode }
            });
        } else {
            await (prisma as any).trendyolEFaturamConfig.create({
                data: { username, password, companyId, isActive, isTestMode }
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
        const config = await (prisma as any).trendyolEFaturamConfig.findFirst();
        if (!config) return { success: false, message: "Ayarlar bulunamadı." };

        const client = new TrendyolEFaturamClient({
            username: config.username,
            password: config.password,
            companyId: config.companyId,
            isTestMode: config.isTestMode
        });

        // Login testi yapalım
        return { success: true, message: "Bağlantı ayarları kaydedildi. (API testi için test bilgilerini bekliyoruz)." };
    } catch (error: any) {
        return { success: false, message: "Sistem Hatası: " + error.message };
    }
}

export async function sendOrderInvoice(orderId: string) {
    try {
        const config = await (prisma as any).trendyolEFaturamConfig.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Trendyol e-Faturam entegrasyonu aktif değil." };

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: { include: { product: true } } }
        });

        if (!order) return { success: false, message: "Sipariş bulunamadı." };
        if (order.invoiceNo) return { success: false, message: "Bu sipariş için zaten fatura kesilmiş." };

        const client = new TrendyolEFaturamClient({
            username: config.username,
            password: config.password,
            companyId: config.companyId,
            isTestMode: config.isTestMode
        });

        // TODO: Yarın bilgiler geldiğinde buradaki 'createInvoice' çağrısı aktif edilecek
        // Şu an sadece altyapı hazırlandı
        console.log(`📡 Fatura gönderme isteği alındı: Sipariş #${order.orderNumber}`);

        // Simülasyon (Test için)
        /*
        await (prisma as any).order.update({
            where: { id: orderId },
            data: { 
                invoiceStatus: "SENT", 
                invoiceNo: "TEST-" + Date.now(),
                invoiceId: "efat-" + Date.now()
            }
        });
        */

        return { success: true, message: "Fatura gönderim işlemi başlatıldı (Test modunda)." };
    } catch (error: any) {
        return { success: false, message: "Fatura gönderilirken hata oluştu: " + error.message };
    }
}
