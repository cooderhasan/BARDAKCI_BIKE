"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { generateOrderNumber } from "@/lib/helpers";
import { sendOrderConfirmationEmail, sendAdminNewOrderEmail } from "@/lib/email";
import { addMarketplaceSyncJob } from "@/lib/queue/producer";

interface OrderItem {
    productId: string;
    quantity: number;
    listPrice: number;
    vatRate: number;
    variantId?: string;
    variantInfo?: string;
}

// ... types
interface CreateOrderData {
    items: OrderItem[];
    shippingAddress: {
        name: string;
        address: string;
        city: string;
        district?: string;
        phone: string;
    };
    guestEmail?: string; // For guest checkout
    cargoCompany?: string;
    notes?: string;
    discountRate: number;
    paymentMethod?: "BANK_TRANSFER" | "CREDIT_CARD" | "CURRENT_ACCOUNT";
    shippingCost?: number;
    shippingDesi?: number;
}

export async function createOrder(data: CreateOrderData) {
    const session = await auth();
    const userId = session?.user?.id;
    const isDealer = session?.user?.role === "DEALER" && session?.user?.status === "APPROVED";

    // Guest checkout requires email
    if (!userId && !data.guestEmail) {
        return { success: false, error: "E-posta adresi gereklidir." };
    }

    try {
        // Get discount rate - only dealers get discounts
        let effectiveDiscountRate = 0;

        if (userId && isDealer) {
            const currentUser = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    discountGroup: {
                        select: { discountRate: true }
                    }
                }
            });
            effectiveDiscountRate = Number(currentUser?.discountGroup?.discountRate || 0);
        }


        // Calculate totals
        let subtotal = 0; // Net total (excluding VAT)
        let totalDiscountAmount = 0;
        let totalVatAmount = 0;
        let grandTotal = 0; // Final payable amount
        let eligibleForBankDiscountTotal = 0;

        // Verify products and calculate amounts
        const orderItems = await Promise.all(
            data.items.map(async (item) => {
                const product = await prisma.product.findUnique({
                    where: { id: item.productId },
                });

                if (!product) {
                    throw new Error(`Ürün bulunamadı: ${item.productId}`);
                }

                let unitPrice = Number(product.listPrice);
                let stockToCheck = product.stock;
                let productName = product.name;

                // Handle bundle stock check
                if ((product as any).isBundle) {
                    const bundleItems = await prisma.bundleItem.findMany({
                        where: { bundleProductId: product.id },
                        include: { childProduct: { select: { stock: true, name: true } } },
                    });
                    if (bundleItems.length > 0) {
                        // Bundle stock = min(childStock / childQty)
                        stockToCheck = Math.min(
                            ...bundleItems.map(bi => Math.floor(bi.childProduct.stock / bi.quantity))
                        );
                    }
                }

                // Handle variant if exists
                if (item.variantId) {
                    const variant = await prisma.productVariant.findUnique({
                        where: { id: item.variantId },
                    });

                    if (!variant) {
                        throw new Error(`Varyant bulunamadı: ${item.variantId}`);
                    }

                    stockToCheck = variant.stock;
                    unitPrice += Number(variant.priceAdjustment);
                }

                if (item.quantity < product.minQuantity) {
                    throw new Error(
                        `${productName} için minimum sipariş adedi ${product.minQuantity}`
                    );
                }

                if (item.quantity > stockToCheck) {
                    throw new Error(
                        `${productName} için stokta sadece ${stockToCheck} adet var`
                    );
                }

                // Calculation Logic (Tax Included Input)

                // 1. Fetch Sale Price if exists
                const salePrice = product.salePrice ? Number(product.salePrice) : null;

                // 2. Calculate Dealer Price (if applicable)
                const dealerPrice = unitPrice * (1 - effectiveDiscountRate / 100);

                // 3. Determine Best Price
                let finalUnitPrice = dealerPrice;
                let appliedItemDiscountRate = effectiveDiscountRate;

                // Check Best Price Logic
                if (salePrice !== null && salePrice > 0) {
                    // If Sale Price is better (lower) than Dealer Price
                    if (salePrice < dealerPrice) {
                        finalUnitPrice = salePrice;
                        // Calculate effective discount rate for record keeping
                        appliedItemDiscountRate = ((unitPrice - salePrice) / unitPrice) * 100;
                    }
                }

                // 4. Gross Line Total (List Price * Qty) - For reference, but we use Final Unit Price
                // Actually, lineTotal is what matters.

                // Discounted Total for the line
                const discountedLineTotal = finalUnitPrice * item.quantity;

                // Discount Amount
                const itemDiscount = (unitPrice * item.quantity) - discountedLineTotal;

                // 5. Back-calculate VAT from the Discounted Total
                // Formula: Price = Net * (1 + VAT%) => Net = Price / (1 + VAT%)
                const vatRate = product.vatRate;
                const netLineTotal = discountedLineTotal / (1 + vatRate / 100);
                const itemVat = discountedLineTotal - netLineTotal;

                // Accumulate
                subtotal += netLineTotal;
                totalDiscountAmount += itemDiscount;
                totalVatAmount += itemVat;
                grandTotal += discountedLineTotal;

                const hasCampaignDiscount = salePrice !== null && salePrice < Number(product.listPrice);
                if (!hasCampaignDiscount) {
                    eligibleForBankDiscountTotal += discountedLineTotal;
                }

                return {
                    productId: product.id,
                    productName: productName,
                    quantity: item.quantity,
                    unitPrice: unitPrice, // Storing List Price as Unit Price
                    discountRate: appliedItemDiscountRate, // Storing Effective Discount Rate
                    vatRate: product.vatRate,
                    lineTotal: discountedLineTotal,
                    variantId: item.variantId,
                    variantInfo: item.variantInfo,
                };
            })
        );

        // Fetch Site Settings for Bank Info & Discounts
        const settingsRecord = await prisma.siteSettings.findUnique({
            where: { key: "general" },
        });
        const settings = settingsRecord?.value as any || {};
        const bankTransferDiscountRate = Number(settings.bankTransferDiscount) || 0;

        let finalGrandTotal = grandTotal + (data.shippingCost || 0);
        let appliedBankDiscount = 0;

        if (data.paymentMethod === "BANK_TRANSFER" && bankTransferDiscountRate > 0) {
            appliedBankDiscount = (eligibleForBankDiscountTotal * bankTransferDiscountRate) / 100;
            finalGrandTotal -= appliedBankDiscount;
        }

        const total = finalGrandTotal;
        const discountAmount = totalDiscountAmount + appliedBankDiscount; // For record keeping
        const vatAmount = totalVatAmount;
        const paymentMethod = data.paymentMethod || "BANK_TRANSFER";
        const orderNumber = generateOrderNumber();

        // Create order with transaction
        const transactionResult = await prisma.$transaction(async (tx) => {
            // Check Critical Limit for Current Account (only for logged in users)
            if (paymentMethod === "CURRENT_ACCOUNT" && userId) {
                const user = await tx.user.findUnique({
                    where: { id: userId },
                    select: {
                        creditLimit: true,
                        transactions: {
                            select: { type: true, amount: true }
                        }
                    }
                });

                if (!user) throw new Error("Kullanıcı bulunamadı.");

                const totalDebit = user.transactions
                    .filter(t => t.type === "DEBIT")
                    .reduce((acc, t) => acc + Number(t.amount), 0);

                const totalCredit = user.transactions
                    .filter(t => t.type === "CREDIT")
                    .reduce((acc, t) => acc + Number(t.amount), 0);

                const currentDebt = totalDebit - totalCredit;
                const creditLimit = Number(user.creditLimit);
                const availableLimit = creditLimit - currentDebt;

                if (total > availableLimit) {
                    throw new Error(`Yetersiz bakiye. Sipariş tutarı: ${total.toFixed(2)} TL, Kullanılabilir Limit: ${availableLimit.toFixed(2)} TL`);
                }
            }

            // Create order
            const newOrder = await tx.order.create({
                data: {
                    orderNumber: orderNumber,
                    userId: userId || undefined, // undefined for guest orders
                    guestEmail: data.guestEmail || undefined,
                    subtotal,
                    discountAmount,
                    appliedDiscountRate: data.discountRate,
                    vatAmount,
                    total,
                    status: paymentMethod === "CURRENT_ACCOUNT" ? "CONFIRMED" :
                        paymentMethod === "CREDIT_CARD" ? "WAITING_FOR_PAYMENT" : "PENDING",
                    shippingAddress: data.shippingAddress as any,
                    cargoCompany: data.cargoCompany,
                    shippingCost: data.shippingCost,
                    shippingDesi: data.shippingDesi,
                    notes: data.notes,
                    items: {
                        create: orderItems,
                    },
                } as any,
            });

            // Create payment record
            await tx.payment.create({
                data: {
                    orderId: newOrder.id,
                    method: paymentMethod,
                    status: paymentMethod === "CURRENT_ACCOUNT" ? "COMPLETED" : "PENDING",
                    amount: total,
                },
            });

            // If Current Account, Add Transaction (only for logged in users)
            if (paymentMethod === "CURRENT_ACCOUNT" && userId) {
                await tx.currentAccountTransaction.create({
                    data: {
                        userId: userId,
                        type: "DEBIT",
                        processType: "ORDER",
                        amount: total,
                        description: `Sipariş No: ${orderNumber}`,
                        orderId: newOrder.id,
                    }
                });
            }

            // Update stock
            for (const item of data.items) {
                // Check if this product is a bundle
                const productWithBundle = await tx.product.findUnique({
                    where: { id: item.productId },
                    select: {
                        isBundle: true,
                        bundleItems: {
                            select: {
                                childProductId: true,
                                quantity: true,
                            },
                        },
                    },
                });

                if (productWithBundle?.isBundle && productWithBundle.bundleItems.length > 0) {
                    // Bundle product: decrement stock from each child product
                    for (const bundleItem of productWithBundle.bundleItems) {
                        await tx.product.update({
                            where: { id: bundleItem.childProductId },
                            data: {
                                stock: {
                                    decrement: bundleItem.quantity * item.quantity,
                                },
                            },
                        });
                    }
                } else if (item.variantId) {
                    await tx.productVariant.update({
                        where: { id: item.variantId },
                        data: {
                            stock: {
                                decrement: item.quantity,
                            },
                        },
                    });
                } else {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: {
                            stock: {
                                decrement: item.quantity,
                            },
                        },
                    });
                }
            }

            // Return the list of affected product IDs as well
            const affectedProductIds = Array.from(new Set(data.items.map(i => i.productId)));

            return { newOrder, affectedProductIds };
        });

        const { newOrder: order, affectedProductIds } = transactionResult;

        // --- MARKETPLACE STOCK SYNC ---
        // If stock reached critical level, this will push stock=0 immediately (no queue delay)
        // Also syncs to ALL marketplaces (Trendyol, N11, HB)
        if (affectedProductIds.length > 0) {
            import("@/lib/stock-sync").then(({ handlePostOrderStockSync }) => {
                handlePostOrderStockSync(affectedProductIds, "site").catch(console.error);
            }).catch(console.error);
        }

        // Fetch User Company Name for email (if logged in)
        let userForEmail = null;
        if (userId) {
            userForEmail = await prisma.user.findUnique({
                where: { id: userId },
                select: { companyName: true, email: true }
            });
        }

        // Site Settings already fetched earlier for bank info


        // Send confirmation email (to user email or guest email)
        // ONLY if payment method is NOT Credit Card. 
        // For Credit Card, we will send email in the PayTR Callback (success)
        if (paymentMethod !== "CREDIT_CARD") {
            const emailTo = userForEmail?.email || data.guestEmail;
            const emailItems = orderItems.map((item) => ({
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: Number(item.unitPrice),
                lineTotal: item.lineTotal,
                variantInfo: item.variantInfo || undefined,
            }));

            if (emailTo) {
                sendOrderConfirmationEmail({
                    to: emailTo,
                    orderNumber: order.orderNumber,
                    customerName: data.shippingAddress.name,
                    items: emailItems,
                    totalAmount: total,
                    paymentMethod: paymentMethod,
                    bankInfo: paymentMethod === "BANK_TRANSFER" ? {
                        bankName: settings.bankName || "",
                        iban: settings.bankIban1 || "",
                        accountHolder: settings.bankAccountName || "",
                    } : undefined,
                    shippingAddress: {
                        address: data.shippingAddress.address,
                        city: data.shippingAddress.city,
                        district: data.shippingAddress.district,
                        phone: data.shippingAddress.phone,
                    },
                    cargoCompany: data.cargoCompany,
                    shippingCost: data.shippingCost,
                    source: order.source,
                }).catch((err) => {
                    console.error("Failed to send order confirmation email:", err);
                });
            }

            // Send admin notification (fire and forget)
            sendAdminNewOrderEmail({
                orderNumber: order.orderNumber,
                customerName: data.shippingAddress.name,
                companyName: userForEmail?.companyName || data.shippingAddress.name, // Fallback to person name
                totalAmount: total,
                orderId: order.id,
                cargoCompany: data.cargoCompany,
                items: emailItems,
            }).catch((err) => {
                console.error("Failed to send admin notification email:", err);
            });
        }

        return { success: true, orderId: order.id };
    } catch (error) {
        console.error("Order creation error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Sipariş oluşturulurken bir hata oluştu.",
        };
    }
}
