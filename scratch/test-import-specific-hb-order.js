const fs = require('fs');
const path = require('path');

// Manually parse .env file
const envPath = path.join('d:', 'SRN', '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
                value = value.substring(1, value.length - 1);
            }
            process.env[key] = value;
        }
    });
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const config = await prisma.hepsiburadaConfig.findFirst({ where: { isActive: true } });
        if (!config) {
            console.log("❌ Aktif Hepsiburada entegrasyonu bulunamadı.");
            return;
        }

        const username = config.username;
        const password = config.password;
        const merchantId = config.merchantId || username;
        const isTestMode = config.isTestMode ?? false;

        const sitSuffix = isTestMode ? "-sit" : "";
        const orderBaseUrl = isTestMode 
            ? "https://ims-external-sit.hepsiburada.com" 
            : "https://ims-external.hepsiburada.com";

        const pair = `${username}:${password}`;
        const authHeader = `Basic ${Buffer.from(pair).toString("base64")}`;
        
        const orderNumber = "4623285863";
        const url = `${orderBaseUrl}/orders/merchantid/${merchantId}/ordernumber/${orderNumber}`;
        
        console.log(`📡 Hepsiburada Siparişi Sorgulanıyor: ${url}`);
        
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": authHeader,
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "serinmotor_dev"
            }
        });

        if (!response.ok) {
            console.error(`❌ Hepsiburada API Hatası: ${response.status}`);
            const text = await response.text();
            console.error(text);
            return;
        }

        const res = await response.json();
        const allItems = res?.items || (Array.isArray(res) ? res : [res]);
        
        console.log(`📡 Sipariş Kalem Sayısı: ${allItems.length}`);
        
        for (const item of allItems) {
            try {
                const calculatedOrderNumber = item.orderNumber || item.orderId || String(item.id);
                console.log(`👉 Kalem Detayı:`, JSON.stringify(item));

                // 1. Önce HepsiburadaProduct tablosundaki özel sihirbaz eşleşmelerine bakalım
                let product = null;
                const hbConditions = [];
                if (item.merchantSku) {
                    hbConditions.push({ merchantSku: String(item.merchantSku) });
                }
                if (item.sku) {
                    hbConditions.push({ hbSku: String(item.sku) });
                    hbConditions.push({ merchantSku: String(item.sku) });
                }

                if (hbConditions.length > 0) {
                    const hbMapping = await prisma.hepsiburadaProduct.findFirst({
                        where: { OR: hbConditions },
                        include: { product: true }
                    });
                    if (hbMapping && hbMapping.product) {
                        product = hbMapping.product;
                    }
                }

                // 2. Eğer özel eşleşme bulunamazsa, doğrudan Product tablosundaki sku ve barkod ile eşleştir
                if (!product) {
                    const searchConditions = [];
                    if (item.merchantSku) searchConditions.push({ sku: String(item.merchantSku) });
                    if (item.sku) searchConditions.push({ sku: String(item.sku) });
                    if (item.barcode) searchConditions.push({ barcode: String(item.barcode) });

                    if (searchConditions.length > 0) {
                        product = await prisma.product.findFirst({
                            where: { OR: searchConditions }
                        });
                    }
                }

                console.log(`   🔍 Eşleşen Ürün:`, product ? `${product.name} (ID: ${product.id})` : "BULUNAMADI!");

                const unitPrice = item.unitPrice?.amount || item.unitPrice || item.totalPrice?.amount || 0;
                const quantity = item.quantity || 1;
                const lineTotal = unitPrice * quantity;
                const vatRate = item.vatRate || item.vat || 20;

                const orderItems = [{
                    productId: product?.id || null,
                    quantity: quantity,
                    unitPrice: unitPrice,
                    productName: item.name || item.productName || "HB Ürün",
                    lineTotal: lineTotal,
                    vatRate: vatRate,
                    discountRate: 0
                }];

                const shipping = item.shippingAddress || {};
                const invoice = item.invoice || {};
                const customerName = shipping.name || item.customerName || "Hepsiburada Müşterisi";
                const customerEmail = shipping.email || item.customerEmail || "hb@customer.com";
                const customerPhone = shipping.phoneNumber || shipping.phone || "";

                const taxNumber = invoice.taxNumber || invoice.turkishIdentityNumber || "";
                const taxOffice = invoice.taxOffice || "";

                console.log("   💾 Veritabanına kaydetme deneniyor...");
                
                // Daha önce import edilmiş mi?
                const existing = await prisma.order.findUnique({
                    where: { orderNumber: calculatedOrderNumber }
                });
                
                if (existing) {
                    console.log(`   ⚠️ Sipariş (${calculatedOrderNumber}) veritabanında zaten mevcut!`);
                    continue;
                }

                const created = await prisma.order.create({
                    data: {
                        orderNumber: calculatedOrderNumber,
                        status: "CONFIRMED",
                        total: item.totalPrice?.amount || lineTotal,
                        subtotal: lineTotal,
                        discountAmount: item.hbDiscount?.amount || item.discountPriceToBeInvoicedHb || 0,
                        appliedDiscountRate: 0,
                        vatAmount: lineTotal * (vatRate / (100 + vatRate)),
                        guestEmail: customerEmail,
                        shippingAddress: {
                            fullName: customerName,
                            address: shipping.address || "",
                            city: shipping.city || "",
                            district: shipping.town || shipping.district || "",
                            phone: customerPhone,
                        },
                        billingAddress: invoice.address ? {
                            fullName: invoice.name || customerName,
                            address: invoice.address || "",
                            city: invoice.city || "",
                            district: invoice.town || "",
                            taxNumber: taxNumber,
                            taxOffice: taxOffice,
                        } : undefined,
                        items: {
                            create: orderItems.filter(i => i.productId)
                        },
                        source: "HEPSIBURADA",
                        cargoCompany: item.shippingCompanyName || null,
                        shipmentPackageId: String(item.id || ""),
                    }
                });

                console.log(`   ✅ Başarıyla Kaydedildi! Order ID: ${created.id}`);

            } catch (err) {
                console.error(`   ❌ Kalem Kayıt Hatası:`, err);
            }
        }

    } catch (e) {
        console.error("Ana Hata:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
