import axios from "axios";

export interface EFaturamAuth {
    username: string; // E-Faturam email
    password: string; // E-Faturam şifre
    companyId?: string;
    earchivePrefix?: string;
    efaturaPrefix?: string;
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
                
                // Token'dan ID'leri çöz
                const decoded = this.decodeToken(token);
                if (decoded) {
                    console.log('🔑 DECODED TOKEN:', JSON.stringify(decoded, null, 2));
                    // userId: number olarak sakla
                    const rawUserId = decoded.userId || decoded.id || decoded.sub || (typeof response.data === 'number' ? response.data : null);
                    this.userId = rawUserId ? Number(rawUserId) : null;

                    // companyId extraction: try multiple sources
                    let extractedCompanyId = null;
                    if (decoded.companyId) extractedCompanyId = decoded.companyId;
                    else if (decoded.cid) extractedCompanyId = decoded.cid;
                    else if (decoded.account_id) extractedCompanyId = decoded.account_id;
                    else if (decoded.privs && Object.keys(decoded.privs).length > 0) {
                        // Trendyol E-Faturam often puts companyId as keys in 'privs'
                        const keys = Object.keys(decoded.privs);
                        // Filter for keys that look like numeric IDs (usually long numbers)
                        const numericKey = keys.find(k => /^\d+$/.test(k));
                        if (numericKey) extractedCompanyId = numericKey;
                    }

                    (this as any).companyId = 
                        (this.auth.companyId ? Number(this.auth.companyId) : null) ||
                        (extractedCompanyId ? Number(extractedCompanyId) : null) ||
                        this.userId;

                    console.log(`✅ Token Decoded: userId=${this.userId}, companyId=${(this as any).companyId}`);
                } else {
                    const rawUserId = typeof response.data === 'number' ? response.data : null;
                    this.userId = rawUserId ? Number(rawUserId) : null;
                    (this as any).companyId = (this.auth.companyId ? Number(this.auth.companyId) : null) || this.userId;
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

    private async request<T = any>(method: string, endpoint: string, data?: any, customHeaders?: Record<string, string>): Promise<T> {
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
                    ...customHeaders,
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

    async testConnection(): Promise<{ success: boolean; message: string; prefixes?: string[] }> {
        try {
            await this.login();
            const prefixes = await this.getAvailablePrefixes();
            return {
                success: true,
                message: `Bağlantı başarılı! (UserId: ${this.userId}, CompanyId: ${(this as any).companyId})`,
                prefixes: prefixes ? [prefixes] : [] // getAvailablePrefixes currently returns string | null, I'll update it to be more robust if needed
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
     * Login sonrası token bilgilerini döndürür (debug)
     */
    async getDebugInfo(): Promise<any> {
        await this.ensureToken();
        return {
            userId: this.userId,
            companyId: (this as any).companyId,
            hasToken: !!this.accessToken,
        };
    }

    /**
     * Hesapta tanımlı seri prefix'lerini listeler.
     * Birden fazla endpoint denenir (API versiyonuna göre değişebilir).
     */
    async getAvailablePrefixes(): Promise<string | null> {
        // Trendyol E-Faturam'ın bilinen prefix endpoint alternatifleri
        const candidateEndpoints = [
            "/api/invoice/corporate-prefix",
            "/api/invoice/prefix",
            "/api/company/prefix",
            "/api/invoice/serial",
            "/api/invoice/series",
        ];

        for (const endpoint of candidateEndpoints) {
            try {
                const result = await this.request("GET", endpoint);
                console.log(`📋 Prefix endpoint [${endpoint}] yanıtı:`, JSON.stringify(result, null, 2));

                // API farklı formatlarda dönebilir
                let prefix: string | null = null;
                if (Array.isArray(result) && result.length > 0) {
                    const first = result[0];
                    prefix = first?.prefix || first?.code || first?.value || first?.invoiceSeries || first?.serialNumber || null;
                } else if (result?.prefix) {
                    prefix = result.prefix;
                } else if (result?.data && Array.isArray(result.data) && result.data.length > 0) {
                    prefix = result.data[0]?.prefix || result.data[0]?.code || result.data[0]?.serialNumber || null;
                } else if (typeof result === 'string' && result.length > 0 && result.length <= 10) {
                    prefix = result;
                }

                if (prefix) {
                    console.log(`✅ Prefix bulundu [${endpoint}]: ${prefix}`);
                    return prefix;
                }
            } catch (error: any) {
                console.warn(`⚠️ Prefix endpoint [${endpoint}] çalışmadı: ${error.message}`);
                // Sonraki endpoint'i dene
            }
        }

        console.warn("⚠️ Hiçbir prefix endpoint'i sonuç döndürmedi. Prefix gönderilmeden devam ediliyor.");
        return null;
    }

    /**
     * E-Arşiv Fatura Oluşturma
     */
    async createEArchiveInvoice(rawInvoiceData: any): Promise<any> {
        await this.ensureToken(); // Önce ID'lerin dolduğundan emin olalım

        const taxableTotal = rawInvoiceData.taxExcludedPrice;
        const totalTax = rawInvoiceData.taxAmount;

        // Ayarlardan gelen prefix'i kullan
        const invoicePrefix = this.auth.earchivePrefix;
        console.log(`🏷️ Kullanılacak prefix: ${invoicePrefix || "VARSAYILAN"} | userId=${this.userId} | companyId=${(this as any).companyId}`);

        const formattedData: any = {
            autoInvoiceId: true,
            userId: this.userId,
            companyId: (this as any).companyId,
            source: "PARTNER",
            appCode: "SelfIntegration",
            recipientInfo: {
                taxId: rawInvoiceData.receiverTaxId.toString(),
                name: rawInvoiceData.receiverName,
                surname: rawInvoiceData.receiverSurname || "",
                title: rawInvoiceData.receiverTitle || "",
                city: rawInvoiceData.receiverCity || "İSTANBUL",
                district: rawInvoiceData.receiverDistrict || "MERKEZ",
                address: rawInvoiceData.receiverAddress || "ADRES BELİRTİLMEMİŞ",
                countryCode: "TR",
                email: rawInvoiceData.receiverEmail || "",
                taxOffice: rawInvoiceData.receiverTaxOffice || "MERKEZ",
            },
            issuedAt: new Date().toISOString(),
            invoiceInfo: {
                invoiceType: "EARSIVFATURA",
                invoiceTypeCode: rawInvoiceData.invoiceTypeCode || "SATIS",
                invoiceDate: new Date().toISOString(),
                currencyCode: "TRY",
            },
            invoiceLines: rawInvoiceData.invoiceLines.map((line: any) => ({
                itemName: line.name,
                quantity: Number(line.quantity),
                unitCode: "C62",
                unitPriceAmount: this.toKurus(line.unitPrice),
                taxPercent: Number(line.taxRate),
                taxAmount: this.toKurus(line.taxAmount),
                taxableAmount: this.toKurus(line.amount - line.taxAmount),
                totalAmount: this.toKurus(line.amount),
                totalDiscountAmount: line.discountAmount ? this.toKurus(line.discountAmount) : 0,
                taxName: "KDV",
                taxCode: "0015",
                totalTax: {
                    totalTaxAmount: this.toKurus(line.taxAmount),
                    subTotalTaxes: [{
                        taxAmount: this.toKurus(line.taxAmount),
                        taxableAmount: this.toKurus(line.amount - line.taxAmount),
                        percent: Number(line.taxRate),
                        taxType: "KDV",
                    }]
                }
            })),
            totalTax: {
                totalTaxAmount: this.toKurus(totalTax),
                subTotalTaxes: [{
                    taxAmount: this.toKurus(totalTax),
                    taxableAmount: this.toKurus(taxableTotal),
                    percent: Number(rawInvoiceData.invoiceLines[0]?.taxRate || 20),
                    taxType: "KDV",
                }],
            },
            invoiceTotal: {
                lineExtensionAmount: this.toKurus(taxableTotal),
                taxExclusiveAmount: this.toKurus(taxableTotal),
                taxInclusiveAmount: this.toKurus(rawInvoiceData.taxInclusiveAmount),
                payableAmount: this.toKurus(rawInvoiceData.payableAmount),
                allowanceTotalAmount: rawInvoiceData.discountAmount ? this.toKurus(rawInvoiceData.discountAmount) : 0,
            },
            notes: rawInvoiceData.notes || "",
            deliveryInfo: {
                carrierTaxId: rawInvoiceData.carrierTaxId || "3130557323",
                carrierName: rawInvoiceData.carrierName || "YURTİÇİ KARGO SERVİSİ A.Ş.",
                sentAt: new Date().toISOString(),
            },
            paymentInfo: {
                paymentType: "KREDIKARTI/BANKAKARTI",
                paymentMeans: "CREDIT_CARD",
                paymentDate: new Date().toISOString(),
                purchaseUrl: rawInvoiceData.purchaseUrl || "https://bardakcibike.com.tr",
            }
        };

        // GRS prefix "Partner" tipinde oluşturuldu. source, prefix tipiyle eşleşmeli.
        // source="PARTNER" + prefix="GRS" → Partner tipi prefix kullanılır.
        if (invoicePrefix && invoicePrefix.trim() !== "") {
            formattedData.prefix = invoicePrefix.trim().substring(0, 3).toUpperCase();
        }

        console.log(`📤 E-Arşiv Fatura Payload:`, JSON.stringify(formattedData, null, 2));

        try {
            // İlk deneme: PARTNER source ile
            return await this.request("POST", "/api/invoice/documents/earchive", formattedData);
        } catch (error: any) {
            // Prefix/source hatası aldıysak, source=WEB olarak tekrar dene
            if (error.message?.includes("refix") || error.message?.includes("409") || error.message?.includes("404")) {
                console.warn(`⚠️ İlk deneme başarısız! source=WEB ile tekrar deneniyor...`);
                formattedData.source = "WEB";
                console.log(`📤 Retry Payload (source=WEB):`, JSON.stringify(formattedData, null, 2));
                try {
                    return await this.request("POST", "/api/invoice/documents/earchive", formattedData);
                } catch (retryError: any) {
                    // WEB de çalışmadıysa, prefix kaldırıp son deneme
                    if (retryError.message?.includes("refix") || retryError.message?.includes("409")) {
                        console.warn(`⚠️ WEB de başarısız! Prefix kaldırılıp deneniyor...`);
                        delete formattedData.prefix;
                        return await this.request("POST", "/api/invoice/documents/earchive", formattedData);
                    }
                    throw retryError;
                }
            }
            throw error;
        }
    }

    /**
     * E-Fatura oluşturma (kurumsal alıcılar için)
     * Alıcının e-Fatura mükellefi olması gerekir
     */
    async createEInvoice(rawInvoiceData: any): Promise<any> {
        await this.ensureToken();

        const taxableTotal = rawInvoiceData.taxExcludedPrice;
        const totalTax = rawInvoiceData.taxAmount;

        const invoicePrefix = this.auth.efaturaPrefix;
        console.log(`🏷️ E-Fatura prefix: ${invoicePrefix || "VARSAYILAN"} | userId=${this.userId} | companyId=${(this as any).companyId}`);

        const formattedData: any = {
            autoInvoiceId: true,
            userId: this.userId,
            companyId: (this as any).companyId,
            source: "PARTNER",
            appCode: "SelfIntegration",
            recipientInfo: {
                taxId: rawInvoiceData.receiverTaxId.toString(),
                alias: rawInvoiceData.receiverAlias || "",
                name: rawInvoiceData.receiverName,
                surname: rawInvoiceData.receiverSurname || "",
                title: rawInvoiceData.receiverTitle || "",
                city: rawInvoiceData.receiverCity || "İSTANBUL",
                district: rawInvoiceData.receiverDistrict || "MERKEZ",
                address: rawInvoiceData.receiverAddress || "ADRES BELİRTİLMEMİŞ",
                countryCode: "TR",
                email: rawInvoiceData.receiverEmail || "",
                taxOffice: rawInvoiceData.receiverTaxOffice || "MERKEZ",
            },
            issuedAt: new Date().toISOString(),
            invoiceInfo: {
                invoiceType: rawInvoiceData.receiverAlias ? "TEMELFATURA" : "TEMELFATURA",
                invoiceTypeCode: rawInvoiceData.invoiceTypeCode || "SATIS",
                invoiceDate: new Date().toISOString(),
                currencyCode: "TRY",
            },
            invoiceLines: rawInvoiceData.invoiceLines.map((line: any) => ({
                itemName: line.name,
                quantity: Number(line.quantity),
                unitCode: "C62",
                unitPriceAmount: this.toKurus(line.unitPrice),
                taxPercent: Number(line.taxRate),
                taxAmount: this.toKurus(line.taxAmount),
                taxableAmount: this.toKurus(line.amount - line.taxAmount),
                totalAmount: this.toKurus(line.amount),
                totalDiscountAmount: line.discountAmount ? this.toKurus(line.discountAmount) : 0,
                taxName: "KDV",
                taxCode: "0015",
                totalTax: {
                    totalTaxAmount: this.toKurus(line.taxAmount),
                    subTotalTaxes: [{
                        taxAmount: this.toKurus(line.taxAmount),
                        taxableAmount: this.toKurus(line.amount - line.taxAmount),
                        percent: Number(line.taxRate),
                        taxType: "KDV",
                    }]
                }
            })),
            totalTax: {
                totalTaxAmount: this.toKurus(totalTax),
                subTotalTaxes: [{
                    taxAmount: this.toKurus(totalTax),
                    taxableAmount: this.toKurus(taxableTotal),
                    percent: Number(rawInvoiceData.invoiceLines[0]?.taxRate || 20),
                    taxType: "KDV",
                }],
            },
            invoiceTotal: {
                lineExtensionAmount: this.toKurus(taxableTotal),
                taxExclusiveAmount: this.toKurus(taxableTotal),
                taxInclusiveAmount: this.toKurus(rawInvoiceData.taxInclusiveAmount),
                payableAmount: this.toKurus(rawInvoiceData.payableAmount),
                allowanceTotalAmount: rawInvoiceData.discountAmount ? this.toKurus(rawInvoiceData.discountAmount) : 0,
            },
            notes: rawInvoiceData.notes || "",
            deliveryInfo: {
                carrierTaxId: rawInvoiceData.carrierTaxId || "3130557323",
                carrierName: rawInvoiceData.carrierName || "YURTİÇİ KARGO SERVİSİ A.Ş.",
                sentAt: new Date().toISOString(),
            },
            paymentInfo: {
                paymentType: "KREDIKARTI/BANKAKARTI",
                paymentMeans: "CREDIT_CARD",
                paymentDate: new Date().toISOString(),
                purchaseUrl: rawInvoiceData.purchaseUrl || "https://bardakcibike.com.tr",
            }
        };

        // E-Fatura prefix'i (GSB gibi)
        if (invoicePrefix && invoicePrefix.trim() !== "") {
            formattedData.prefix = invoicePrefix.trim().substring(0, 3).toUpperCase();
        }

        console.log(`📤 E-Fatura Payload:`, JSON.stringify(formattedData, null, 2));

        try {
            return await this.request("POST", "/api/invoice/documents/outgoing-einvoice", formattedData);
        } catch (error: any) {
            if (error.message?.includes("refix") || error.message?.includes("409") || error.message?.includes("404")) {
                console.warn(`⚠️ E-Fatura ilk deneme başarısız! source=WEB ile tekrar deneniyor...`);
                formattedData.source = "WEB";
                delete formattedData.appCode;
                try {
                    return await this.request("POST", "/api/invoice/documents/outgoing-einvoice", formattedData);
                } catch (retryError: any) {
                    if (retryError.message?.includes("refix") || retryError.message?.includes("409")) {
                        delete formattedData.prefix;
                        return await this.request("POST", "/api/invoice/documents/outgoing-einvoice", formattedData);
                    }
                    throw retryError;
                }
            }
            throw error;
        }
    }

    /**
     * Alıcının e-Fatura mükellefi olup olmadığını kontrol et
     * VKN ile sorgulama yapılır
     * Döküman: GET /api/invoice/taxpayers/{taxId}
     * Dönüş: alias listesi (e-Fatura adresi)
     */
    async checkTaxpayer(taxId: string): Promise<{ isEInvoiceUser: boolean; alias?: string; title?: string }> {
        try {
            await this.ensureToken();
            const result = await this.request("GET", `/api/invoice/taxpayers/${taxId}`);
            // Sonuç dizi olarak döner, ilk kaydın alias'ını al
            if (Array.isArray(result) && result.length > 0) {
                return {
                    isEInvoiceUser: true,
                    alias: result[0].alias,
                    title: result[0].title,
                };
            }
            return { isEInvoiceUser: false };
        } catch (error: any) {
            // 404 = e-Fatura mükellefi değil
            return { isEInvoiceUser: false };
        }
    }

    async getInvoicePdf(invoiceId: string): Promise<any> {
        return await this.request("GET", `/api/invoice/pdf/${invoiceId}`);
    }

    /**
     * Kalıcı, herkese açık PDF indirme linki oluştur
     * Bu link auth gerektirmez, N11/HB/müşteriye gönderilebilir
     * POST /api/invoice/documents/download/permanent-url
     */
    async getPermanentDownloadUrl(documentUuid: string, documentType: "EARCHIVE" | "EINVOICE" = "EARCHIVE"): Promise<string | null> {
        try {
            await this.ensureToken();
            const payload = {
                documentType,
                fileExtension: "pdf",
                invoiceUuid: documentUuid,
                companyId: (this as any).companyId,
            };
            console.log(`📎 Kalıcı PDF link isteniyor: UUID=${documentUuid}, Type=${documentType}`);
            
            // Bu endpoint text/plain veya application/problem+json olarak URL döner
            const result = await this.request("POST", "/api/invoice/documents/download/permanent-url", payload, {
                Accept: "text/plain, application/problem+json"
            });
            
            // Cevap string ise direkt URL'dir, object ise url alanını al
            const url = typeof result === "string" ? result : (result?.url || result?.downloadUrl || null);
            console.log(`📎 Kalıcı PDF link:`, url);
            return url;
        } catch (error: any) {
            console.error(`❌ Kalıcı PDF link hatası:`, error.message);
            return null;
        }
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
