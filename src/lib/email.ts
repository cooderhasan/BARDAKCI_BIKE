import { Resend } from 'resend';
import { OrderConfirmationEmail } from '@/emails/order-confirmation';
import { AdminNewOrderEmail } from '@/emails/admin-new-order';
import { ShippingNotificationEmail } from '@/emails/shipping-notification';
import { AbandonedCartNotificationEmail } from '@/emails/abandoned-cart-notification';
import { InvoiceNotificationEmail } from '@/emails/invoice-notification';
import { PasswordResetEmail } from '@/emails/password-reset';
import { generateOrderContracts } from './pdf-generator';

const resend = new Resend(process.env.RESEND_API_KEY || "re_123456789");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "emreserin78@gmail.com";

interface SendOrderConfirmationProps {
    to: string;
    orderNumber: string;
    customerName: string;
    items: {
        productName: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        variantInfo?: string;
    }[];
    totalAmount: number;
    paymentMethod: "BANK_TRANSFER" | "CREDIT_CARD" | "CURRENT_ACCOUNT";
    bankInfo?: {
        bankName: string;
        iban: string;
        accountHolder: string;
    };
    shippingAddress: {
        address: string;
        city: string;
        district?: string;
        phone?: string;
    };
    cargoCompany?: string;
    shippingCost?: number;
    source?: string;
}

interface SendAdminNewOrderProps {
    orderNumber: string;
    customerName: string;
    companyName: string;
    totalAmount: number;
    orderId: string;
    cargoCompany?: string;
    items: {
        productName: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        variantInfo?: string;
    }[];
}

export async function sendOrderConfirmationEmail(props: SendOrderConfirmationProps) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY is not set. Email sending skipped.');
        return { success: false, error: 'API key missing' };
    }

    try {
        let attachments: { filename: string; content: Buffer }[] | undefined = undefined;
        
        // PDF'leri yalnızca kendi e-ticaret sitemizden (WEB) gelen siparişler için üretiyoruz
        if ((props.source || "WEB") === "WEB") {
            try {
                const pdfs = await generateOrderContracts({
                    orderNumber: props.orderNumber,
                    customerName: props.customerName,
                    customerPhone: props.shippingAddress.phone || "",
                    customerEmail: props.to,
                    shippingAddress: {
                        address: props.shippingAddress.address,
                        city: props.shippingAddress.city,
                        district: props.shippingAddress.district,
                    },
                    items: props.items,
                    totalAmount: props.totalAmount,
                    paymentMethod: props.paymentMethod,
                    shippingCost: props.shippingCost,
                });
                attachments = [
                    {
                        filename: 'on-bilgilendirme-formu.pdf',
                        content: pdfs.preInfoForm,
                    },
                    {
                        filename: 'mesafeli-satis-sozlesmesi.pdf',
                        content: pdfs.distanceSalesContract,
                    },
                    {
                        filename: 'iptal-ve-iade-kosullari.pdf',
                        content: pdfs.cancellationRefundPolicy,
                    }
                ];
            } catch (pdfErr) {
                console.error('Sözleşme PDFleri üretilirken hata oluştu:', pdfErr);
            }
        }

        const { data, error } = await resend.emails.send({
            from: 'Sipariş <siparis@serinmotor.com>',
            to: [props.to],
            subject: `Siparişiniz Alındı - #${props.orderNumber}`,
            react: OrderConfirmationEmail({
                orderNumber: props.orderNumber,
                customerName: props.customerName,
                items: props.items,
                totalAmount: props.totalAmount,
                paymentMethod: props.paymentMethod,
                bankInfo: props.bankInfo,
            }),
            attachments: attachments && attachments.length > 0 ? attachments : undefined,
        });

        if (error) {
            console.error('Email sending error:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Email sending failed:', error);
        return { success: false, error };
    }
}

export async function sendAdminNewOrderEmail(props: SendAdminNewOrderProps) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY is not set. Admin email sending skipped.');
        return { success: false, error: 'API key missing' };
    }

    if (!ADMIN_EMAIL) {
        console.warn('ADMIN_EMAIL is not set. Admin email sending skipped.');
        return { success: false, error: 'Admin email missing' };
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'Sipariş Bildirim <siparis@serinmotor.com>',
            to: [ADMIN_EMAIL],
            subject: `Yeni Sipariş: #${props.orderNumber} - ${props.companyName}`,
            react: AdminNewOrderEmail({
                orderNumber: props.orderNumber,
                orderId: props.orderId,
                customerName: props.customerName,
                companyName: props.companyName,
                totalAmount: props.totalAmount,
                items: props.items,
            }),
        });

        if (error) {
            console.error('Admin email sending error:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Admin email sending failed:', error);
        return { success: false, error };
    }
}

interface SendShippingNotificationProps {
    to: string;
    customerName: string;
    orderNumber: string;
    cargoCompany: string;
    trackingUrl: string;
}

export async function sendShippingNotificationEmail(props: SendShippingNotificationProps) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY is not set. Email sending skipped.');
        return { success: false, error: 'API key missing' };
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'Sipariş <siparis@serinmotor.com>',
            to: [props.to],
            // Bcc to admin to track sent emails
            bcc: ADMIN_EMAIL ? [ADMIN_EMAIL] : undefined,
            subject: `Siparişiniz Kargoya Verildi - #${props.orderNumber}`,
            react: ShippingNotificationEmail({
                orderNumber: props.orderNumber,
                customerName: props.customerName,
                cargoCompany: props.cargoCompany,
                trackingUrl: props.trackingUrl,
            }),
        });

        if (error) {
            console.error('Shipping notification email sending error:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Shipping notification email sending failed:', error);
        return { success: false, error };
    }
}

interface SendAbandonedCartNotificationProps {
    to: string;
    customerName: string;
    items: {
        productName: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        imageUrl?: string;
    }[];
    totalAmount: number;
    continueShoppingUrl: string;
}

export async function sendAbandonedCartEmail(props: SendAbandonedCartNotificationProps) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY is not set. Email sending skipped.');
        return { success: false, error: 'API key missing' };
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'Serin Motor <siparis@serinmotor.com>',
            to: [props.to],
            subject: 'Sepetinizde Ürünler Sizi Bekliyor!',
            react: AbandonedCartNotificationEmail({
                customerName: props.customerName,
                items: props.items,
                totalAmount: props.totalAmount,
                continueShoppingUrl: props.continueShoppingUrl,
            }),
        });

        if (error) {
            console.error('Abandoned cart email sending error:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Abandoned cart email sending failed:', error);
        return { success: false, error };
    }
}

interface SendInvoiceNotificationProps {
    to: string;
    orderNumber: string;
    customerName: string;
    invoiceNo: string;
    invoiceUrl: string;
    totalAmount: number;
}

export async function sendInvoiceNotificationEmail(props: SendInvoiceNotificationProps) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY is not set. Invoice email sending skipped.');
        return { success: false, error: 'API key missing' };
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'Fatura <fatura@serinmotor.com>',
            to: [props.to],
            subject: `Faturanız Hazır - #${props.orderNumber}`,
            react: InvoiceNotificationEmail({
                orderNumber: props.orderNumber,
                customerName: props.customerName,
                invoiceNo: props.invoiceNo,
                invoiceUrl: props.invoiceUrl,
                totalAmount: props.totalAmount,
                invoiceDate: new Date().toLocaleDateString('tr-TR'),
            }),
        });

        if (error) {
            console.error('Invoice email sending error:', error);
            return { success: false, error };
        }

        console.log(`📧 Fatura e-postası gönderildi: ${props.to} (Sipariş: ${props.orderNumber})`);
        return { success: true, data };
    } catch (error) {
        console.error('Invoice email sending failed:', error);
        return { success: false, error };
    }
}

// ==================== PASSWORD RESET ====================

interface SendPasswordResetEmailProps {
    to: string;
    customerName: string;
    resetUrl: string;
    expiresInMinutes?: number;
}

export async function sendPasswordResetEmail(props: SendPasswordResetEmailProps) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY is not set. Password reset email sending skipped.');
        return { success: false, error: 'API key missing' };
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'Hesap <hesap@serinmotor.com>',
            to: [props.to],
            subject: 'Şifre Sıfırlama Talebi',
            react: PasswordResetEmail({
                customerName: props.customerName,
                resetUrl: props.resetUrl,
                expiresInMinutes: props.expiresInMinutes || 60,
            }),
        });

        if (error) {
            console.error('Password reset email sending error:', error);
            return { success: false, error };
        }

        console.log(`🔑 Şifre sıfırlama e-postası gönderildi: ${props.to}`);
        return { success: true, data };
    } catch (error) {
        console.error('Password reset email sending failed:', error);
        return { success: false, error };
    }
}
