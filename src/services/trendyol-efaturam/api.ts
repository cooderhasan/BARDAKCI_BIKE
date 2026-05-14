import axios from "axios";

export interface EFaturamAuth {
    username: string; // E-Faturam email
    password: string; // E-Faturam şifre
    companyId?: string;
    isTestMode?: boolean;
}

export interface InvoiceLine {
    itemName: string;
    quantity: number;
    unitCode?: string; // "C62" (Adet)
    unitPriceAmount: number; // Kuruş
    taxPercent: number; // KDV oranı (20, 10, 1, 0)
    taxAmount: number; // Kuruş
    taxableAmount: number; // Kuruş (Matrah)
    totalAmount: number; // Kuruş (KDV dahil toplam)
    totalDiscountAmount?: number; // Kuruş
}

export interface EArchiveInvoiceData {
    source: string; // "API"
    companyId?: number;
    userId?: number;
    
    recipientInfo: {
        taxId: string;
        name: string;
        surname?: string;
        title?: string;
        city: string;
        district: string;
        address: string;
        countryCode: string; // "TR"
        email?: string;
    };

    invoiceInfo: {
        scenario: "EARSIVFATURA" | "EFATURA";
        invoiceTypeCode: "SATIS" | "IADE";
        currencyCode: string; // "TRY"
        invoiceDate: string; // "2024-05-14"
        invoiceTime: string; // "14:00:00"
        localReferenceId?: string;
    };

    invoiceLines: InvoiceLine[];

    totalTax: {
        totalTaxAmount: number; // Kuruş
        subTotalTaxes: Array<{
            taxAmount: number;
            taxPercent: number;
            taxCode: string; // "0015" (KDV)
        }>;
    };

    invoiceTotal: {
        lineExtensionAmount: number; // Kuruş (KDV hariç toplam)
        taxExclusiveAmount: number; // Kuruş
        taxInclusiveAmount: number; // Kuruş
        payableAmount: number; // Kuruş
        totalDiscountAmount?: number;
    };

    notes?: string[];
}

export class TrendyolEFaturamClient {
    private baseUrl: string;
    private auth: EFaturamAuth;
    private accessToken: string | null = null;
    private userId: number | null = null;
    private tokenExpiry: number = 0;

    constructor(auth: EFaturamAuth) {
        this.auth = auth;
        this.baseUrl = auth.isTestMode
            ? "https://stage-apigateway.trendyolecozum.com"
            : "https://apigateway.trendyolecozum.com";
    }

    /**
     * Giriş yaparak access_token ve userId alır
     */
    private async login(): Promise<boolean> {
        try {
            console.log(`📡 Trendyol e-Faturam Login Attempt (${this.auth.isTestMode ? 'TEST' : 'CANLI'})...`);
            
            const payload: any = {
                password: this.auth.password,
            };

            if (this.auth.username.includes("@")) {
                payload.email = this.auth.username;
                payload.username = this.auth.username;
            } else {
                payload.username = this.auth.username;
            }

            const response = await axios.post(
                `${this.baseUrl}/api/auth/signin`,
                payload,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "User-Agent": "SelfIntegration",
                    },
                }
            );

            // Giriş başarılıysa userId response body'den gelir (örn: 43406)
            if (response.data && typeof response.data === 'number') {
                this.userId = response.data;
            }

            const headers = response.headers;
            const token =
                headers["x-access-token"] ||
                headers["x-refresh-token"] ||
                headers["access_token"] ||
                headers["access-token"] ||
                headers["token"];

            if (token) {
                this.accessToken = token;
                this.tokenExpiry = Date.now() + 55 * 60 * 1000;
                console.log(`✅ Trendyol e-Faturam Login Success (UserId: ${this.userId})`);
                return true;
            }

            throw new Error("Giriş yapıldı ancak token alınamadı.");
        } catch (error: any) {
            console.error("❌ Trendyol Login Error:", error.response?.status, error.response?.data);
            throw new Error(`E-Faturam login hatası: ${error.response?.status || "NETWORK"}`);
        }
    }

    /**
     * TL tutarını Kuruş'a çevirir
     */
    private toKurus(amount: number): number {
        return Math.round(amount * 100);
    }

    private async ensureToken(): Promise<void> {
        if (!this.accessToken || Date.now() >= this.tokenExpiry) {
            await this.login();
        }
    }

    private async request<T = any>(method: string, endpoint: string, data?: any): Promise<T> {
        await this.ensureToken();

        try {
            const response = await axios({
                method,
                url: `${this.baseUrl}${endpoint}`,
                data,
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    "User-Agent": "SelfIntegration",
                },
                timeout: 30000,
            });
            return response.data;
        } catch (error: any) {
            const errorDetail = error.response?.data
                ? JSON.stringify(error.response.data)
                : error.message;
            console.error(`❌ E-Faturam API Error [${method} ${endpoint}]:`, error.response?.status, errorDetail);
            throw new Error(`E-Faturam API Hatası (${error.response?.status || "NETWORK"}): ${errorDetail}`);
        }
    }

    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            await this.login();
            return {
                success: true,
                message: `Bağlantı başarılı! (UserId: ${this.userId})`,
            };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async checkTaxPayer(taxId: string): Promise<{ isEFatura: boolean; alias: string | null }> {
        try {
            const result = await this.request("GET", `/api/taxpayer/check/${taxId}`);
            return {
                isEFatura: result?.isTaxPayer || result?.isRegistered || false,
                alias: result?.alias || null,
            };
        } catch (error) {
            return { isEFatura: false, alias: null };
        }
    }

    /**
     * E-Arşiv Fatura Oluşturma
     */
    async createEArchiveInvoice(rawInvoiceData: any): Promise<any> {
        // Ham veriyi Kuruş bazlı dokümantasyon formatına çevirelim
        const formattedData: EArchiveInvoiceData = {
            source: "API",
            userId: this.userId || undefined,
            companyId: this.auth.companyId ? parseInt(this.auth.companyId) : (this.userId || undefined),
            recipientInfo: {
                taxId: rawInvoiceData.receiverTaxId,
                name: rawInvoiceData.receiverName,
                surname: rawInvoiceData.receiverSurname,
                title: rawInvoiceData.receiverTitle,
                city: rawInvoiceData.receiverCity || "İSTANBUL",
                district: rawInvoiceData.receiverDistrict || "MERKEZ",
                address: rawInvoiceData.receiverAddress || "ADRES BELİRTİLMEMİŞ",
                countryCode: "TR",
                email: rawInvoiceData.receiverEmail,
            },
            invoiceInfo: {
                scenario: "EARSIVFATURA",
                invoiceTypeCode: rawInvoiceData.invoiceTypeCode || "SATIS",
                currencyCode: rawInvoiceData.currency || "TRY",
                invoiceDate: new Date().toISOString().split('T')[0],
                invoiceTime: new Date().toTimeString().split(' ')[0],
                localReferenceId: rawInvoiceData.localReferenceId,
            },
            invoiceLines: rawInvoiceData.invoiceLines.map((line: any) => ({
                itemName: line.name,
                quantity: line.quantity,
                unitCode: "C62",
                unitPriceAmount: this.toKurus(line.unitPrice),
                taxPercent: line.taxRate,
                taxAmount: this.toKurus(line.taxAmount),
                taxableAmount: this.toKurus(line.amount - line.taxAmount),
                totalAmount: this.toKurus(line.amount),
                totalDiscountAmount: line.discountAmount ? this.toKurus(line.discountAmount) : 0,
            })),
            totalTax: {
                totalTaxAmount: this.toKurus(rawInvoiceData.taxAmount),
                subTotalTaxes: [{
                    taxAmount: this.toKurus(rawInvoiceData.taxAmount),
                    taxPercent: rawInvoiceData.invoiceLines[0]?.taxRate || 20,
                    taxCode: "0015",
                }],
            },
            invoiceTotal: {
                lineExtensionAmount: this.toKurus(rawInvoiceData.taxExcludedPrice),
                taxExclusiveAmount: this.toKurus(rawInvoiceData.taxExcludedPrice),
                taxInclusiveAmount: this.toKurus(rawInvoiceData.taxInclusiveAmount),
                payableAmount: this.toKurus(rawInvoiceData.payableAmount),
                totalDiscountAmount: rawInvoiceData.discountAmount ? this.toKurus(rawInvoiceData.discountAmount) : 0,
            },
            notes: rawInvoiceData.notes,
        };

        return await this.request("POST", "/api/invoice/documents/earchive", formattedData);
    }

    async createEInvoice(rawInvoiceData: any): Promise<any> {
        // E-Fatura için de benzer bir dönüşüm yapılabilir
        return await this.request("POST", "/api/invoice/documents/outgoing-einvoice", rawInvoiceData);
    }

    async getInvoicePdf(invoiceId: string): Promise<any> {
        return await this.request("GET", `/api/invoice/pdf/${invoiceId}`);
    }

    async getInvoiceStatus(invoiceId: string): Promise<any> {
        return await this.request("GET", `/api/invoice/status/${invoiceId}`);
    }

    /**
     * Faturları Listeleme
     */
    async listInvoices(page: number = 0, size: number = 20): Promise<any> {
        return await this.request("GET", `/api/invoice/list?page=${page}&size=${size}`);
    }
}
