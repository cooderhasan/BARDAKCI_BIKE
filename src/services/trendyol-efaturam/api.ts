import axios from "axios";

export interface EFaturamAuth {
    username: string; // E-Faturam email
    password: string; // E-Faturam şifre
    companyId?: string;
    isTestMode?: boolean;
}

export interface InvoiceLine {
    name: string;
    quantity: number;
    unitCode?: string; // "C62" (Adet), "KGM" (kg), "MTR" (metre) vb.
    unitPrice: number;
    taxRate: number; // KDV oranı (20, 10, 1, 0)
    taxAmount: number;
    amount: number; // quantity * unitPrice
    discountAmount?: number;
}

export interface EArchiveInvoiceData {
    // Fatura Genel Bilgileri
    scenario: "EARSIVFATURA";
    invoiceTypeCode: "SATIS" | "IADE";
    currency: string; // "TRY"
    localReferenceId?: string; // Kendi sisteminizdeki referans ID (örn: sipariş numarası)

    // Alıcı Bilgileri
    receiverName: string;
    receiverSurname?: string;
    receiverTitle?: string; // Ticari Unvan (şirket ise)
    receiverTaxId: string; // VKN veya TCKN (11 hane TCKN, 10 hane VKN)
    receiverTaxOffice?: string; // Vergi Dairesi
    receiverAddress?: string;
    receiverCity?: string;
    receiverDistrict?: string;
    receiverCountry?: string; // "Türkiye"
    receiverEmail?: string; // E-arşiv fatura alıcı mail

    // Tutar Bilgileri
    taxExcludedPrice: number; // KDV Hariç Toplam
    taxAmount: number; // Toplam KDV
    taxInclusiveAmount: number; // KDV Dahil Toplam (KDV hariç + KDV)
    payableAmount: number; // Ödenecek Toplam (genelde taxInclusiveAmount ile aynı)
    discountAmount?: number; // İndirim Tutarı

    // Fatura Kalemleri
    invoiceLines: InvoiceLine[];

    // Ek Bilgiler
    notes?: string[];
    issuedAt?: string; // Fatura tarihi (ISO format)
}

export class TrendyolEFaturamClient {
    private baseUrl: string;
    private auth: EFaturamAuth;
    private accessToken: string | null = null;
    private tokenExpiry: number = 0;

    constructor(auth: EFaturamAuth) {
        this.auth = auth;
        this.baseUrl = auth.isTestMode
            ? "https://stage-apigateway.trendyolecozum.com"
            : "https://apigateway.trendyolecozum.com";
    }

    /**
     * Giriş yaparak access_token alır
     */
    private async login(): Promise<boolean> {
        try {
            console.log(`📡 Trendyol e-Faturam Login Attempt (${this.auth.isTestMode ? 'TEST' : 'CANLI'})...`);
            console.log(`   Base URL: ${this.baseUrl}`);
            console.log(`   Username/Email: ${this.auth.username}`);

            const payload: any = {
                password: this.auth.password,
            };

            // Username email formatındaysa hem email hem username gönder
            if (this.auth.username.includes("@")) {
                payload.email = this.auth.username;
                payload.username = this.auth.username;
            } else {
                payload.username = this.auth.username;
            }

            // CompanyId varsa taxId olarak da gönder (Sadece deneme amaçlı, hata verirse kaldırılabilir)
            // Bireysel girişte genelde taxId istenmez.
            
            const response = await axios.post(
                `${this.baseUrl}/api/auth/signin`,
                payload,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "User-Agent": this.auth.companyId ? `${this.auth.companyId} - SelfIntegration` : "SelfIntegration",
                    },
                }
            );

            console.log(`📡 Trendyol Login Status: ${response.status}`);
            
            // Token response header veya body'den gelebilir
            // Tüm headerları küçük harfe çevirip kontrol edelim
            const headers = response.headers;
            const token =
                headers["access_token"] ||
                headers["access-token"] ||
                headers["token"] ||
                headers["authorization"]?.replace("Bearer ", "") ||
                headers["auth-token"] ||
                response.data?.access_token ||
                response.data?.accessToken ||
                response.data?.token;

            if (token) {
                this.accessToken = token;
                this.tokenExpiry = Date.now() + 55 * 60 * 1000;
                console.log("✅ Trendyol e-Faturam Login Success");
                return true;
            }

            // Eğer yanıt sayısal bir değerse (örn: 43406), bu başarılı bir giriştir ama token header'dadır
            // Headerları detaylı loglayalım ki görebilelim
            const allHeaderKeys = Object.keys(headers).join(", ");
            const errorDetail = `Giriş yapıldı (Yanıt: ${JSON.stringify(response.data)}), ancak token bulunamadı. Mevcut Başlıklar: ${allHeaderKeys}`;
            
            console.error(`❌ ${errorDetail}`);
            throw new Error(errorDetail);
        } catch (error: any) {
            if (error.response) {
                console.error("❌ Trendyol Login Error Detail:", error.response.status, error.response.data);
                throw new Error(
                    `E-Faturam login hatası: ${error.response.status} - ${
                        JSON.stringify(error.response.data) || error.message
                    }`
                );
            }
            throw error;
        }
    }

    /**
     * Token geçerliliğini kontrol eder, gerekirse yeniler
     */
    private async ensureToken(): Promise<void> {
        if (!this.accessToken || Date.now() >= this.tokenExpiry) {
            const success = await this.login();
            if (!success) throw new Error("E-Faturam API Login başarısız");
        }
    }

    /**
     * Genel API isteği gönderir
     */
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
                    "User-Agent": this.auth.companyId ? `${this.auth.companyId} - SelfIntegration` : "SelfIntegration",
                },
                timeout: 30000,
            });
            return response.data;
        } catch (error: any) {
            // 401 ise token'ı sıfırla ve tekrar dene
            if (error.response?.status === 401) {
                console.log("🔄 Token expired, re-authenticating...");
                this.accessToken = null;
                this.tokenExpiry = 0;
                await this.ensureToken();

                const retryResponse = await axios({
                    method,
                    url: `${this.baseUrl}${endpoint}`,
                    data,
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        "User-Agent": this.auth.companyId ? `${this.auth.companyId} - SelfIntegration` : "SelfIntegration",
                    },
                    timeout: 30000,
                });
                return retryResponse.data;
            }

            const errorDetail = error.response?.data
                ? JSON.stringify(error.response.data).substring(0, 500)
                : error.message;
            console.error(`❌ E-Faturam API Error [${method} ${endpoint}]:`, error.response?.status, errorDetail);
            throw new Error(`E-Faturam API Hatası (${error.response?.status || "NETWORK"}): ${errorDetail}`);
        }
    }

    /**
     * Login testi - bağlantı bilgilerini doğrular
     */
    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            const success = await this.login();
            if (!success) throw new Error("Giriş yapıldı ama yetki anahtarı (token) alınamadı.");
            
            return {
                success: true,
                message: `Bağlantı başarılı! (${this.auth.isTestMode ? 'Test' : 'Canlı'} ortam)`,
            };
        } catch (error: any) {
            return {
                success: false,
                message: error.message || "Bağlantı hatası",
            };
        }
    }

    /**
     * Mükellef Sorgulama - VKN/TCKN ile müşterinin e-Fatura mükellefi olup olmadığını kontrol eder
     * E-Fatura mükellefi ise e-Fatura, değilse e-Arşiv kesilir.
     */
    async checkTaxPayer(taxId: string): Promise<{ isEFatura: boolean; alias: string | null }> {
        try {
            const result = await this.request<any>("GET", `/api/taxpayer/check/${taxId}`);
            return {
                isEFatura: result?.isTaxPayer || result?.isRegistered || false,
                alias: result?.alias || result?.receiverAlias || null,
            };
        } catch (error) {
            // Mükellef sorgulaması başarısızsa e-Arşiv varsayılan olarak kesilir
            console.log(`ℹ️ Mükellef sorgulaması başarısız (VKN: ${taxId}), e-Arşiv olarak devam edilecek`);
            return { isEFatura: false, alias: null };
        }
    }

    /**
     * E-Arşiv Fatura Oluşturma
     */
    async createEArchiveInvoice(invoiceData: EArchiveInvoiceData): Promise<any> {
        console.log(`📄 E-Arşiv Fatura Oluşturuluyor... Ref: ${invoiceData.localReferenceId}`);
        console.log(`   Alıcı: ${invoiceData.receiverName} ${invoiceData.receiverSurname || ''}`);
        console.log(`   Toplam: ${invoiceData.payableAmount} ${invoiceData.currency}`);
        console.log(`   Kalem Sayısı: ${invoiceData.invoiceLines.length}`);

        const result = await this.request("POST", "/api/invoice/e-arsiv/create", invoiceData);
        console.log("✅ E-Arşiv Fatura oluşturuldu:", JSON.stringify(result).substring(0, 300));
        return result;
    }

    /**
     * E-Fatura Oluşturma (karşı taraf da e-fatura mükellefi ise)
     */
    async createEInvoice(invoiceData: any): Promise<any> {
        console.log(`📄 E-Fatura Oluşturuluyor... Ref: ${invoiceData.localReferenceId}`);
        const result = await this.request("POST", "/api/invoice/e-fatura/create", invoiceData);
        console.log("✅ E-Fatura oluşturuldu:", JSON.stringify(result).substring(0, 300));
        return result;
    }

    /**
     * Fatura PDF Linki Alma
     */
    async getInvoicePdf(invoiceId: string): Promise<any> {
        return await this.request("GET", `/api/invoice/pdf/${invoiceId}`);
    }

    /**
     * Fatura Durumu Sorgulama
     */
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
