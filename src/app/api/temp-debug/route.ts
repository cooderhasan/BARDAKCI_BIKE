import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HepsiburadaClient } from "@/services/hepsiburada/api";

export async function GET() {
    try {
        const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
        if (!config) {
            return NextResponse.json({ success: false, error: "Aktif entegrasyon bulunamadı." });
        }

        const client = new HepsiburadaClient({
            username: config.username,
            password: config.password,
            merchantId: config.merchantId,
            isTestMode: config.isTestMode ?? false,
        });

        const orderNumber = "4623285863";
        let rawOrderData: any = null;
        let fetchError: string | null = null;

        try {
            rawOrderData = await client.getOrderByNumber(orderNumber);
        } catch (err: any) {
            fetchError = err.message;
        }

        if (fetchError) {
            return NextResponse.json({
                success: false,
                message: "Hepsiburada API'sinden sipariş çekilemedi.",
                error: fetchError
            });
        }

        const allItems = rawOrderData?.items || (Array.isArray(rawOrderData) ? rawOrderData : [rawOrderData]);
        const debugResults: any[] = [];

        for (const item of allItems) {
            const calculatedOrderNumber = item.orderNumber || item.orderId || String(item.id);
            
            // Ürün eşleştirme adımlarını taklit edelim
            let product = null;
            const hbConditions: any[] = [];
            if (item.merchantSku) {
                hbConditions.push({ merchantSku: String(item.merchantSku) });
            }
            if (item.sku) {
                hbConditions.push({ hbSku: String(item.sku) });
                hbConditions.push({ merchantSku: String(item.sku) });
            }

            let hbMappingRecord = null;
            if (hbConditions.length > 0) {
                hbMappingRecord = await prisma.hepsiburadaProduct.findFirst({
                    where: { OR: hbConditions },
                    include: { product: true }
                });
                if (hbMappingRecord && hbMappingRecord.product) {
                    product = hbMappingRecord.product;
                }
            }

            let directProduct = null;
            if (!product) {
                const searchConditions: any[] = [];
                if (item.merchantSku) searchConditions.push({ sku: String(item.merchantSku) });
                if (item.sku) searchConditions.push({ sku: String(item.sku) });
                if (item.barcode) searchConditions.push({ barcode: String(item.barcode) });

                if (searchConditions.length > 0) {
                    directProduct = await prisma.product.findFirst({
                        where: { OR: searchConditions }
                    });
                    product = directProduct;
                }
            }

            // Siparişi kaydetmeyi deneyelim ve hatayı yakalayalım
            let dbError: any = null;
            let saveSuccess = false;

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

            try {
                // Test amaçlı transaction başlatmadan doğrudan yazmayı deneyelim
                const existing = await prisma.order.findUnique({
                    where: { orderNumber: calculatedOrderNumber }
                });
                
                if (existing) {
                    saveSuccess = true;
                    const correctPackageNumber = String(item.packageNumber || item.id || "");
                    const cargoName = item.cargoCompany || (item.cargoCompanyModel && item.cargoCompanyModel.name) || item.shippingCompanyName || null;
                    
                    const updateData: any = {};
                    let updated = false;
                    
                    if (existing.shipmentPackageId !== correctPackageNumber) {
                        updateData.shipmentPackageId = correctPackageNumber;
                        updated = true;
                    }
                    if (existing.cargoCompany !== cargoName) {
                        updateData.cargoCompany = cargoName;
                        updated = true;
                    }
                    
                    if (updated) {
                        await prisma.order.update({
                            where: { id: existing.id },
                            data: updateData
                        });
                        dbError = `Zaten kayıtlıydı. Paket numarası '${correctPackageNumber}' ve Kargo Firması '${cargoName}' olarak başarıyla ONARILDI! ✅`;
                    } else {
                        dbError = `Zaten kayıtlı ve veriler doğru. Paket: ${existing.shipmentPackageId}, Kargo: ${existing.cargoCompany}`;
                    }
                } else {
                    // Kalem filtresini simüle edelim. productId null ise hata fırlatacak mı?
                    const filteredItems = orderItems.filter(i => i.productId);
                    if (filteredItems.length === 0) {
                        throw new Error("Eşleşen ürün (productId) bulunamadığı için sipariş kalemi eklenemedi! Şema kuralları gereği OrderItem mutlaka geçerli bir productId içermelidir.");
                    }

                    await prisma.order.create({
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
                                taxNumber: taxNumber || undefined,
                                taxOffice: taxOffice || undefined,
                            },
                            items: {
                                create: filteredItems
                            },
                            source: "HEPSIBURADA",
                            cargoCompany: item.cargoCompany || (item.cargoCompanyModel && item.cargoCompanyModel.name) || item.shippingCompanyName || null,
                            shipmentPackageId: String(item.packageNumber || item.id || ""),
                        }
                    });
                    saveSuccess = true;
                }
            } catch (err: any) {
                dbError = {
                    message: err.message,
                    stack: err.stack,
                    code: err.code
                };
            }

            debugResults.push({
                calculatedOrderNumber,
                itemCodes: {
                    merchantSku: item.merchantSku,
                    sku: item.sku,
                    barcode: item.barcode,
                    name: item.name || item.productName
                },
                hbConditions,
                hbMappingRecordExists: !!hbMappingRecord,
                directProductFound: !!directProduct,
                finalProductMatched: product ? { id: product.id, name: product.name, sku: product.sku } : null,
                dbSaveStatus: {
                    success: saveSuccess,
                    error: dbError
                }
            });
        }

        return NextResponse.json({
            success: true,
            rawApiResponse: rawOrderData,
            debugAnalysis: debugResults
        });

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
