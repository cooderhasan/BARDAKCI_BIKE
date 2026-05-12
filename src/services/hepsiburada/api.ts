
import { prisma } from "@/lib/db";

interface HepsiburadaCreds {
    username: string; // Merchant ID or User
    password: string;
    merchantId?: string;
    isTestMode?: boolean;
}

export class HepsiburadaClient {
    // Test (SIT) Ortamı
    // Listing: https://listing-external-sit.hepsiburada.com
    // Order: https://oms-external-sit.hepsiburada.com
    // Product Upload: https://product-uploader-external-sit.hepsiburada.com
    // Metadata: https://metadata-external-sit.hepsiburada.com
    //
    // Canlı (Production) Ortamı
    // Listing: https://listing-external.hepsiburada.com
    // Order: https://oms-external.hepsiburada.com
    // Product Upload: https://product-uploader-external.hepsiburada.com
    // Metadata: https://metadata-external.hepsiburada.com

    private listingBaseUrl: string;
    private orderBaseUrl: string;
    private productUploadBaseUrl: string;
    private metadataBaseUrl: string;
    private userAgent = "serinmotor_dev"; // Developer Username - HB header zorunlu

    private creds: HepsiburadaCreds | null = null;
    private isTestMode: boolean = false;

    constructor(creds?: HepsiburadaCreds) {
        if (creds) {
            this.creds = creds;
            this.isTestMode = creds.isTestMode ?? false;
        }
        
        // URL'leri ortama göre ayarla
        const sitSuffix = this.isTestMode ? "-sit" : "";
        this.listingBaseUrl = `https://listing-external${sitSuffix}.hepsiburada.com`;
        this.orderBaseUrl = `https://oms-external${sitSuffix}.hepsiburada.com`;
        this.productUploadBaseUrl = `https://product-uploader-external${sitSuffix}.hepsiburada.com`;
        this.metadataBaseUrl = `https://metadata-external${sitSuffix}.hepsiburada.com`;
    }

    async init() {
        if (this.creds) return;
        const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
        if (!config) throw new Error("Aktif Hepsiburada yapılandırması bulunamadı.");

        this.creds = {
            username: config.username,
            password: config.password,
            merchantId: config.merchantId || config.username // Fallback if merchantId creates confusion
        };

        // isTestMode kontrolü (config'den de gelebilir)
        // Şu an HepsiburadaConfig'de isTestMode yok, ama username'den anlaşılabilir
        // veya ileride eklenebilir
    }

    private getAuthHeader() {
        if (!this.creds) throw new Error("Creds missing");
        // Basic Auth: username (Merchant ID) : password (Secret Key)
        const pair = `${this.creds.username}:${this.creds.password}`;
        return `Basic ${Buffer.from(pair).toString("base64")}`;
    }

    private getHeaders(extraHeaders?: Record<string, string>) {
        return {
            "Authorization": this.getAuthHeader(),
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": this.userAgent,
            ...extraHeaders,
        };
    }

    /**
     * Test connection with detailed error reporting
     * Uses Order API as it's more reliable for testing auth
     */
    async checkConnectionDetailed(): Promise<{ success: boolean; message: string }> {
        try {
            await this.init();
            if (!this.creds) return { success: false, message: "Ayarlar yüklenemedi." };

            // Use order API for test as it requires full auth and merchantId context
            const testUrl = `${this.orderBaseUrl}/orders/merchantid/${this.creds.merchantId}?page=0&size=1`;
            
            console.log(`📡 HB Bağlantı Testi: ${testUrl}`);
            console.log(`   Ortam: ${this.isTestMode ? "TEST (SIT)" : "CANLI (Production)"}`);

            const response = await fetch(testUrl, {
                headers: this.getHeaders(),
            });
            
            if (response.ok) {
                return { success: true, message: `Bağlantı Başarılı! (${this.isTestMode ? "Test" : "Canlı"} Ortam)` };
            }

            const errorBody = await response.text();
            console.error(`❌ HB Test Error Body:`, errorBody);

            if (response.status === 401) {
                return { success: false, message: "Yetkisiz Erişim (401). Merchant ID veya Secret Key hatalı." };
            }

            if (response.status === 400) {
                return { success: false, message: `Geçersiz İstek (400). Bilgileri kontrol edin. Detay: ${errorBody.slice(0, 100)}` };
            }

            return { success: false, message: `HB Hatası (${response.status}): ${errorBody.slice(0, 100)}` };

        } catch (error: any) {
            return { success: false, message: "Bağlantı Kurulamadı: " + error.message };
        }
    }

    /**
     * Create/Update Listings (Bulk) - Stok ve Fiyat Güncelleme
     * POST /listings/merchantid/{merchantId}/inventory-uploads
     */
    async uploadInventory(items: any[]) {
        await this.init();
        if (!this.creds?.merchantId) throw new Error("Merchant ID missing");

        const url = `${this.listingBaseUrl}/listings/merchantid/${this.creds.merchantId}/inventory-uploads`;

        console.log(`📡 HB Inventory Upload: ${url} - ${items.length} item(s)`);

        const response = await fetch(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(items)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HB API Error: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    /**
     * Get Orders
     * GET /orders/merchantid/{merchantId}
     * status: New, Unacked, Packed, Shipped, Delivered, Cancelled, UnDelivered
     */
    async getOrders(options: { status?: string; beginDate?: string; endDate?: string; page?: number; size?: number } = {}) {
        await this.init();
        if (!this.creds?.merchantId) throw new Error("Merchant ID missing");

        const { status = "New", page = 0, size = 50 } = options;
        
        let url = `${this.orderBaseUrl}/orders/merchantid/${this.creds.merchantId}?status=${status}&page=${page}&size=${size}`;
        
        if (options.beginDate) url += `&beginDate=${options.beginDate}`;
        if (options.endDate) url += `&endDate=${options.endDate}`;

        console.log(`📡 HB Fetching Orders: ${url}`);

        const response = await fetch(url, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ HB Order API Error: ${response.status}`, errorText);
            throw new Error(`HB Order API Error: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    /**
     * Get Category Attributes (Metadata)
     */
    async getCategoryAttributes(categoryId: string) {
        await this.init();
        const url = `${this.metadataBaseUrl}/categories/${categoryId}/attributes`;
        const response = await fetch(url, {
            headers: this.getHeaders(),
        });
        if (!response.ok) throw new Error("HB Metadata Error");
        return await response.json();
    }

    /**
     * Create Product (Product Upload / Catalog)
     */
    async createProduct(items: any[]) {
        await this.init();
        const url = `${this.productUploadBaseUrl}/products/v2`;
        
        console.log(`📡 HB Product Upload: ${url} - ${items.length} product(s)`);

        const response = await fetch(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(items)
        });
        return await response.json();
    }
}
