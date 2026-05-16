
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
            "User-Agent": "serinmotor_dev",
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
            const testUrl = `${this.orderBaseUrl}/orders/merchantid/${this.creds.merchantId}?limit=1&offset=0`;
            
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
     * Get all listings for this merchant (to map merchantSku -> hepsiburadaSku)
     * GET /listings/merchantid/{merchantId}
     */
    async getListings(limit = 100, offset = 0) {
        await this.init();
        if (!this.creds?.merchantId) throw new Error("Merchant ID missing");

        const url = `${this.listingBaseUrl}/listings/merchantid/${this.creds.merchantId}?limit=${limit}&offset=${offset}`;
        const response = await fetch(url, {
            method: "GET",
            headers: this.getHeaders()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HB Listings Error: ${response.status} - ${errorText}`);
        }

        return await response.json();
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
     * Check inventory upload status by tracking ID
     * GET /listings/merchantid/{merchantId}/inventory-uploads/id/{trackingId}
     */
    async checkInventoryUploadStatus(trackingId: string) {
        await this.init();
        if (!this.creds?.merchantId) throw new Error("Merchant ID missing");

        const url = `${this.listingBaseUrl}/listings/merchantid/${this.creds.merchantId}/inventory-uploads/id/${trackingId}`;
        const response = await fetch(url, {
            method: "GET",
            headers: this.getHeaders()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HB Status Check Error: ${response.status} - ${errorText}`);
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
        
        let url = `${this.orderBaseUrl}/orders/merchantid/${this.creds.merchantId}?status=${status}&limit=${size}&offset=${page * size}`;
        
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
     * Get All Categories
     * SIT: GET https://mpop-sit.hepsiburada.com/product/api/categories/get-all-categories
     * PROD: GET https://mpop.hepsiburada.com/product/api/categories/get-all-categories
     */
    async getCategories(params: { leaf?: boolean; status?: string } = {}) {
        await this.init();
        const sitSuffix = this.isTestMode ? "-sit" : "";
        const { leaf = true, status = "ACTIVE" } = params;
        
        let url = `https://mpop${sitSuffix}.hepsiburada.com/product/api/categories/get-all-categories?status=${status}&size=50000`;
        
        console.log(`📡 HB Fetching Categories: ${url}`);

        const response = await fetch(url, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HB Category API Error: ${response.status} - ${errorText.substring(0, 200)}`);
        }

        return await response.json();
    }

    /**
     * Get Category Attributes (Metadata)
     * SIT: https://mpop-sit.hepsiburada.com/product/api/categories/{categoryId}/attributes
     */
    async getCategoryAttributes(categoryId: string) {
        await this.init();
        const sitSuffix = this.isTestMode ? "-sit" : "";
        const url = `https://mpop${sitSuffix}.hepsiburada.com/product/api/categories/${categoryId}/attributes`;
        const response = await fetch(url, {
            headers: this.getHeaders(),
        });
        if (!response.ok) {
            const errText = await response.text();
            console.error("HB Metadata Error Detail:", response.status, errText);
            throw new Error(`HB Metadata Error (${response.status}): ${errText.substring(0, 100)}`);
        }
        return await response.json();
    }

    async getAttributeValues(categoryId: string, attributeId: string) {
        await this.init();
        const sitSuffix = this.isTestMode ? "-sit" : "";
        const url = `https://mpop${sitSuffix}.hepsiburada.com/product/api/categories/${categoryId}/attribute/${attributeId}/values`;
        const response = await fetch(url, {
            headers: this.getHeaders(),
        });
        if (!response.ok) {
            return [];
        }
        return await response.json();
    }

    /**
     * Create Product (Catalog Upload) - JSON dosyası olarak multipart/form-data ile gönderir
     * SIT: POST https://mpop-sit.hepsiburada.com/product/api/products/import
     * PROD: POST https://mpop.hepsiburada.com/product/api/products/import
     */
    async createProduct(items: any[]) {
        await this.init();
        
        const sitSuffix = this.isTestMode ? "-sit" : "";
        const url = `https://mpop${sitSuffix}.hepsiburada.com/product/api/products/import`;
        
        console.log(`📡 HB Product Upload: ${url} - ${items.length} product(s)`);
        console.log(`   Payload sample:`, JSON.stringify(items[0]).substring(0, 300));

        // HB expects a JSON file upload via multipart/form-data
        const jsonContent = JSON.stringify(items);
        const blob = new Blob([jsonContent], { type: "application/json" });
        
        const formData = new FormData();
        formData.append("file", blob, "integrator.json");

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": this.getAuthHeader(),
                "User-Agent": this.userAgent,
                "Accept": "application/json",
                // Content-Type is automatically set by FormData (multipart/form-data with boundary)
            },
            body: formData
        });
        
        const responseText = await response.text();
        console.log(`   HB Response (${response.status}):`, responseText.substring(0, 500));
        
        if (!response.ok) {
            throw new Error(`HB Product Upload Error (${response.status}): ${responseText.substring(0, 200)}`);
        }
        
        try {
            return JSON.parse(responseText);
        } catch {
            return { success: true, raw: responseText };
        }
    }

    /**
     * Package Items
     * POST /packages/merchantid/{merchantId}
     */
    async packageItems(orderId: string, lineItemIds: string[]) {
        await this.init();
        const url = `${this.orderBaseUrl}/packages/merchantid/${this.creds.merchantId}`;
        
        // Resmi HB docs formatı: lineItemRequests (id+quantity), packageNumber, deci
        const payload = {
            lineItemRequests: lineItemIds.map(id => ({
                id,
                quantity: 1
            })),
            packageNumber: `PKG-${Date.now()}`,
            parcelQuantity: 1,
            deci: 1.0
        };

        console.log(`📦 HB Package URL: ${url}`);
        console.log(`📦 HB Package Payload:`, JSON.stringify(payload));

        const response = await fetch(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`HB Package Error: ${response.status} - ${err}`);
        }

        return await response.json();
    }

    /**
     * Upload Invoice Link
     * POST /orders/merchantid/{merchantId}/packages/{packageId}/invoice-links
     */
    async uploadInvoiceLink(packageId: string, invoiceUrl: string, orderNumber: string) {
        await this.init();
        // Fatura linki: PUT /packages/merchantid/{merchantId}/packagenumber/{packageNumber}/invoice
        const url = `${this.orderBaseUrl}/packages/merchantid/${this.creds.merchantId}/packagenumber/${packageId}/invoice`;
        
        // SIT ortamı için geçerli bir PDF URL'i gereklidir. 
        const finalUrl = invoiceUrl.endsWith(".pdf") ? invoiceUrl : "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

        const payload = {
            invoiceLink: finalUrl,
            contentType: "pdf",
            arrangementDate: new Date().toISOString(),
            serialNumber: "SRN",
            rowNumber: "1",
            invoices: [{
                invoiceLink: finalUrl,
                contentType: "pdf",
                orderNumber: orderNumber,
                arrangementDate: new Date().toISOString(),
                serialNumber: "SRN",
                rowNumber: "1"
            }]
        };

        console.log(`🧾 HB Invoice URL: ${url}`);
        console.log(`🧾 HB Invoice Payload:`, JSON.stringify(payload));

        const response = await fetch(url, {
            method: "PUT",
            headers: this.getHeaders(),
            body: JSON.stringify(payload)
        });

        if (!response.ok && response.status !== 204) {
            const err = await response.text();
            throw new Error(`HB Invoice Upload Error: ${response.status} - ${err}`);
        }

        return true;
    }
}
