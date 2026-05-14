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
    unitCode: string; // "C62" (Adet)
    unitPriceAmount: number; // Kuruş
    taxPercent: number; // KDV oranı (20, 10, 1, 0)
    taxAmount: number; // Kuruş
    taxableAmount: number; // Kuruş (Matrah)
    totalAmount: number; // Kuruş (KDV dahil toplam)
    totalDiscountAmount: number; // Kuruş
}

export interface EArchiveInvoiceData {
    autoInvoiceId: boolean; // true
    companyId: number;
    userId: number;
    source: string; // "WEB"
    
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
        phone?: string;
    };

    invoiceInfo: {
        invoiceType: "EARSIVFATURA" | "EFATURA";
        invoiceTypeCode: "SATIS" | "IADE";
        currencyCode?: string; // "TRY"
    };

    invoiceLines: InvoiceLine[];

    totalTax: {
        totalTaxAmount: number; // Kuruş
        subTotalTaxes: Array<{
            taxAmount: number;
            taxableAmount: number;
            taxPercent: number;
            taxCode: string; // "0015" (KDV)
        }>;
    };

    invoiceTotal: {
        lineExtensionAmount: number; // Kuruş (KDV hariç toplam)
        taxExclusiveAmount: number; // Kuruş
        taxInclusiveAmount: number; // Kuruş
        payableAmount: number; // Kuruş
        allowanceTotalAmount: number; // İndirim tutarı (0 veya tutar)
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
    private decodeToken(token: string): any {
        try {
            const base64Url = token.split('.')[1];
            if (!base64Url) return null;
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = Buffer.from(base64, 'base64').toString();
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error("❌ Token Decode Error:", e);
            return null;
        }
    }

    private async login(): Promise<boolean> {
        try {
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
                
                console.log('🔍 FULL SIGNIN RESPONSE:', JSON.stringify(response.data, null, 2));
                
                // Token'ı çözüp ID'leri alalım
                const decoded = this.decodeToken(token);
                if (decoded) {
                    console.log('🔑 DECODED TOKEN:', JSON.stringify(decoded, null, 2));
                    this.userId = decoded.userId || decoded.id || decoded.sub || (typeof response.data === 'number' ? response.data : 43406);
                    // Eğer token içinde companyId yoksa, bilinen TCKN'yi (26479888956) veya userId'yi deneyelim
                    (this as any).companyId = decoded.companyId || decoded.cid || decoded.account_id || this.userId;
                    
                    console.log(`✅ Token Decoded: userId=${this.userId}, companyId=${(this as any).companyId}`);
                } else {
                    this.userId = typeof response.data === 'number' ? response.data : 43406;
                    (this as any).companyId = this.userId;
                }
                
                return true;
            }

            throw new Error("Giriş yapıldı ancak token alınamadı.");
        } catch (error: any) {
            throw new Error(`E-Faturam login hatası: ${error.response?.status || "NETWORK"}`);
        }
    }

    private toKurus(amount: number): number {
        return Math.round(Number(amount) * 100);
    }

    private async ensureToken(): Promise<void> {
        if (!this.accessToken || Date.now() >= this.tokenExpiry) {
            await this.login();
        }
    }

    private async request<T = any>(method: string, endpoint: string, data?: any): Promise<T> {
        await this.ensureToken();

        try {
            console.log(`🚀 E-Faturam Request: ${method} ${endpoint}`);
            if (data) console.log(`📦 Payload: ${JSON.stringify(data)}`);

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
        await this.ensureToken(); // Önce ID'lerin dolduğundan emin olalım

        const taxableTotal = rawInvoiceData.taxExcludedPrice;
        const totalTax = rawInvoiceData.taxAmount;

        const formattedData: any = {
            autoInvoiceId: true,
            invoiceSeries: "TYA",
            vknPrefix: "TYA", // Yeni keşfedilen doğru alan ismi
            userId: 43406,
            companyId: 43144000001,
            source: "PARTNER", // WEB yerine PARTNER kullanmalıyız
            recipientInfo: {
                taxId: rawInvoiceData.receiverTaxId.toString(),
                name: rawInvoiceData.receiverName,
                surname: rawInvoiceData.receiverSurname || "",
                title: rawInvoiceData.receiverTitle,
                city: rawInvoiceData.receiverCity || "İSTANBUL",
                district: rawInvoiceData.receiverDistrict || "MERKEZ",
                address: rawInvoiceData.receiverAddress || "ADRES BELİRTİLMEMİŞ",
                countryCode: "TR",
                email: rawInvoiceData.receiverEmail,
                phone: rawInvoiceData.receiverPhone,
            },
            invoiceInfo: {
                invoiceType: "EARSIVFATURA",
                invoiceTypeCode: rawInvoiceData.invoiceTypeCode || "SATIS",
                currencyCode: "TRY",
            },
            invoiceLines: rawInvoiceData.invoiceLines.map((line: any) => ({
                itemName: line.name,
                quantity: Number(line.quantity),
                unitCode: "C62",
                unitPriceAmount: this.toKurus(line.unitPrice),
                taxPercent: Number(line.taxRate),
                taxAmount: this.toKurus(line.taxAmount),
                totalTax: {
                    totalTaxAmount: this.toKurus(line.taxAmount),
                    subTotalTaxes: [{
                        taxAmount: this.toKurus(line.taxAmount),
                        taxableAmount: this.toKurus(line.amount - line.taxAmount),
                        taxPercent: Number(line.taxRate),
                        taxCode: "0015",
                    }]
                },
                taxableAmount: this.toKurus(line.amount - line.taxAmount),
                totalAmount: this.toKurus(line.amount),
                totalDiscountAmount: line.discountAmount ? this.toKurus(line.discountAmount) : 0,
            })),
            totalTax: {
                totalTaxAmount: this.toKurus(totalTax),
                subTotalTaxes: [{
                    taxAmount: this.toKurus(totalTax),
                    taxableAmount: this.toKurus(taxableTotal),
                    taxPercent: Number(rawInvoiceData.invoiceLines[0]?.taxRate || 20),
                    taxCode: "0015",
                }],
            },
            invoiceTotal: {
                lineExtensionAmount: this.toKurus(taxableTotal),
                taxExclusiveAmount: this.toKurus(taxableTotal),
                taxInclusiveAmount: this.toKurus(rawInvoiceData.taxInclusiveAmount),
                payableAmount: this.toKurus(rawInvoiceData.payableAmount),
                allowanceTotalAmount: rawInvoiceData.discountAmount ? this.toKurus(rawInvoiceData.discountAmount) : 0,
            },
            notes: rawInvoiceData.notes,
        };

        return await this.request("POST", "/api/invoice/documents/earchive", formattedData);
    }

    async createEInvoice(rawInvoiceData: any): Promise<any> {
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
