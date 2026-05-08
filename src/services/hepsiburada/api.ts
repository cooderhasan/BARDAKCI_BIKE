
import { prisma } from "@/lib/db";

interface HepsiburadaCreds {
    username: string; // Merchant ID or User
    password: string;
    merchantId?: string;
}

export class HepsiburadaClient {
    // Listing API (https://listing-external-sit.hepsiburada.com for test, produce for prod)
    // Production Listing API: https://listing-external.hepsiburada.com
    // Production Order API: https://oms-external.hepsiburada.com

    private listingBaseUrl = "https://listing-external.hepsiburada.com";
    private orderBaseUrl = "https://oms-external.hepsiburada.com";

    private creds: HepsiburadaCreds | null = null;

    constructor(creds?: HepsiburadaCreds) {
        if (creds) {
            this.creds = creds;
        }
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
    }

    private getAuthHeader() {
        if (!this.creds) throw new Error("Creds missing");
        // Basic Auth
        const pair = `${this.creds.username}:${this.creds.password}`;
        return `Basic ${Buffer.from(pair).toString("base64")}`;
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
            
            const response = await fetch(testUrl, {
                headers: { 
                    "Authorization": this.getAuthHeader(),
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            });
            
            if (response.ok) {
                return { success: true, message: "Tamam" };
            }

            const errorBody = await response.text();
            console.error(`❌ HB Test Error Body:`, errorBody);

            if (response.status === 401) {
                return { success: false, message: "Yetkisiz Erişim (401). Servis Anahtarı veya Merchant ID hatalı." };
            }

            if (response.status === 400) {
                return { success: false, message: `Geçersiz İstek (400). Bilgileri kontrol edin. Detay: ${errorBody.slice(0, 50)}` };
            }

            return { success: false, message: `HB Hatası (${response.status}): ${errorBody.slice(0, 50)}` };

        } catch (error: any) {
            return { success: false, message: "Bağlantı Kurulamadı: " + error.message };
        }
    }

    /**
     * Create/Update Listings (Bulk)
     * POST /listings/merchantid/{merchantId}/inventory-uploads
     */
    async uploadInventory(items: any[]) {
        await this.init();
        if (!this.creds?.merchantId) throw new Error("Merchant ID missing");

        const url = `${this.listingBaseUrl}/listings/merchantid/${this.creds.merchantId}/inventory-uploads`;

        // Hepsiburada format is specific. Usually XML or JSON depending on version.
        // Modern API uses JSON.
        // Payload structure: 
        // [ { merchantSku: "...", price: 100, availableStock: 10, dispatchTime: 3, cargoCompany1: "Yurtici", ... } ]

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": this.getAuthHeader(),
                "Content-Type": "application/json"
            },
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
            headers: { 
                "Authorization": this.getAuthHeader(),
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
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
        // HB uses metadata-external API for attributes
        const url = `https://metadata-external.hepsiburada.com/categories/${categoryId}/attributes`;
        const response = await fetch(url, {
            headers: { "Authorization": this.getAuthHeader() }
        });
        if (!response.ok) throw new Error("HB Metadata Error");
        return await response.json();
    }

    /**
     * Create Product (Product Upload)
     */
    async createProduct(items: any[]) {
        await this.init();
        const url = `https://product-uploader-external.hepsiburada.com/products/v2`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": this.getAuthHeader(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify(items)
        });
        return await response.json();
    }
}
