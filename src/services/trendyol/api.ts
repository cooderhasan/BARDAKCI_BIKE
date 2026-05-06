
import { prisma } from "@/lib/db";
import { TrendyolConfig } from "@prisma/client";

interface TrendyolCreds {
    supplierId: string;
    apiKey: string;
    apiSecret: string;
}

export class TrendyolClient {
    private gatewayUrl = "https://apigw.trendyol.com";
    private creds: TrendyolCreds | null = null;

    constructor(creds?: TrendyolCreds) {
        if (creds) {
            this.creds = creds;
        }
    }

    /**
     * Initialize client by fetching active config from DB
     */
    async init() {
        if (this.creds) return;

        const config = await (prisma as any).trendyolConfig.findFirst({
            where: { isActive: true }
        });

        if (!config) {
            throw new Error("Active Trendyol configuration not found.");
        }

        this.creds = {
            supplierId: config.supplierId,
            apiKey: config.apiKey,
            apiSecret: config.apiSecret
        };
    }

    private getHeaders(): Record<string, string> {
        if (!this.creds) throw new Error("Client not initialized.");
        const pair = `${this.creds.apiKey}:${this.creds.apiSecret}`;
        return {
            "Authorization": `Basic ${Buffer.from(pair).toString("base64").trim()}`,
            "User-Agent": `${this.creds.supplierId} - SelfIntegration`,
            "Content-Type": "application/json"
        };
    }

    /**
     * Test connection with detailed error reporting
     * Uses the new endpoint: GET /integration/product/sellers/{sellerId}/products
     */
    async checkConnectionDetailed(): Promise<{ success: boolean; message: string }> {
        try {
            await this.init();
            if (!this.creds) return { success: false, message: "Ayarlar yüklenemedi." };

            const response = await fetch(`${this.gatewayUrl}/integration/product/sellers/${this.creds.supplierId}/products?size=1`, {
                headers: this.getHeaders()
            });
            
            if (response.ok) {
                return { success: true, message: "Tamam" };
            }

            const errorText = await response.text();
            let detail = "";
            try {
                const parsed = JSON.parse(errorText);
                detail = parsed.message || parsed.errorMessage || errorText;
            } catch {
                detail = errorText;
            }

            if (response.status === 401) {
                return { success: false, message: "Yetkisiz Erişim (401). API Key veya Secret hatalı." };
            }

            if (response.status === 403) {
                return { success: false, message: `Erişim Reddedildi (403). Trendyol Mesajı: ${detail}` };
            }

            return { success: false, message: `Trendyol Hatası (${response.status}): ${detail}` };

        } catch (error: any) {
            return { success: false, message: "Bağlantı Kurulamadı: " + error.message };
        }
    }

    /**
     * Get Brands from Trendyol
     */
    async getBrands(page = 0, size = 100) {
        await this.init();
        const response = await fetch(`${this.gatewayUrl}/integration/product/brands?page=${page}&size=${size}`, {
            headers: this.getHeaders()
        });

        if (!response.ok) throw new Error(`Trendyol API Error: ${response.statusText}`);
        return await response.json();
    }

    /**
     * Search Brands by Name
     * GET /integration/product/brands/by-name?name={name}
     */
    async getBrandByName(name: string) {
        await this.init();
        const url = `${this.gatewayUrl}/integration/product/brands/by-name?name=${encodeURIComponent(name)}`;
        const response = await fetch(url, {
            headers: this.getHeaders()
        });

        if (!response.ok) throw new Error(`Trendyol API Error: ${response.statusText}`);
        return await response.json(); // Returns an array of {id, name}
    }

    /**
     * Get Categories
     */
    async getCategories() {
        await this.init();
        const response = await fetch(`${this.gatewayUrl}/integration/product/product-categories`, {
            headers: this.getHeaders()
        });
        if (!response.ok) throw new Error(`Trendyol API Error: ${response.statusText}`);
        return await response.json();
    }

    /**
     * Create Products (Bulk)
     * POST /integration/product/sellers/{sellerId}/products
     */
    async createProducts(items: any[]) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const url = `${this.gatewayUrl}/integration/product/sellers/${this.creds.supplierId}/products`;

        const response = await fetch(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({ items })
        });

        const data = await response.json();
        return { ok: response.ok, ...data };
    }

    /**
     * Update Price and Inventory
     * POST /integration/inventory/sellers/{sellerId}/products/price-and-inventory
     */
    async updatePriceAndInventory(items: { barcode: string, quantity?: number, salePrice?: number, listPrice?: number }[]) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const url = `${this.gatewayUrl}/integration/inventory/sellers/${this.creds.supplierId}/products/price-and-inventory`;

        const response = await fetch(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({ items })
        });

        const data = await response.json();
        return { ok: response.ok, ...data };
    }

    /**
     * Get Attributes for a Category
     * GET /integration/product/product-categories/{categoryId}/attributes
     */
    async getCategoryAttributes(categoryId: number) {
        await this.init();
        const response = await fetch(`${this.gatewayUrl}/integration/product/product-categories/${categoryId}/attributes`, {
            headers: this.getHeaders()
        });
        if (!response.ok) throw new Error(`Trendyol API Error: ${response.statusText}`);
        return await response.json();
    }

    /**
     * Get Orders
     * GET /integration/order/sellers/{sellerId}/orders
     */
    async getOrders(status: string = "Created", size: number = 50, startDate?: number, endDate?: number) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        // Convert common status words to Trendyol specific
        let queryParams = `?size=${size}&status=${status}`;

        // Use provided dates or default to past 1 week
        const start = startDate || (new Date().getTime() - (7 * 24 * 60 * 60 * 1000));
        const end = endDate || new Date().getTime();
        
        queryParams += `&startDate=${start}`;
        queryParams += `&endDate=${end}`;

        const url = `${this.gatewayUrl}/integration/order/sellers/${this.creds.supplierId}/orders${queryParams}`;

        const response = await fetch(url, {
            headers: this.getHeaders()
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Trendyol API Error: ${errorData.message || response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Get Single Order Details
     * GET /integration/order/sellers/{sellerId}/orders?orderNumber={orderNumber}
     */
    async getOrderDetails(orderNumber: string) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const url = `${this.gatewayUrl}/integration/order/sellers/${this.creds.supplierId}/orders?orderNumber=${orderNumber}`;
        const response = await fetch(url, {
            headers: this.getHeaders()
        });

        if (!response.ok) throw new Error(`Trendyol API Error: ${response.statusText}`);
        const data = await response.json();
        return data.content?.[0] || null;
    }



    /**
     * Get Default Cargo and Addresses
     * Fetches providers and addresses, returns the default or first ones.
     */
    async getDefaultCargoAndAddresses() {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        let cargoCompanyId = 10; // Default MNG (usually 10 or 11)
        let shipmentAddressId = 0;
        let returningAddressId = 0;

        try {
            // Get Addresses directly from correct endpoint
            const addrRes = await fetch(`${this.gatewayUrl}/integration/sellers/${this.creds.supplierId}/addresses`, { headers: this.getHeaders() });
            if (addrRes.ok) {
                const addrData = await addrRes.json();
                if (addrData && addrData.supplierAddresses && addrData.supplierAddresses.length > 0) {
                    const addresses = addrData.supplierAddresses;
                    // Try to find default ones
                    const defaultShipment = addresses.find((a: any) => ((a.addressTypes && a.addressTypes.includes('Shipment')) || a.addressType === 'Shipment') && a.default);
                    const defaultReturning = addresses.find((a: any) => ((a.addressTypes && a.addressTypes.includes('Returning')) || a.addressType === 'Returning' || a.addressType === 'Return') && a.default);
                    
                    shipmentAddressId = defaultShipment ? defaultShipment.id : addresses[0].id;
                    returningAddressId = defaultReturning ? defaultReturning.id : addresses[0].id;
                }
            }
        } catch (e) {
            console.error("Failed to fetch default cargo/addresses from Trendyol", e);
        }

        return { cargoCompanyId, shipmentAddressId, returningAddressId };
    }
    /**
     * Get Seller's Products from Trendyol
     * GET /integration/product/sellers/{sellerId}/products
     */
    async getSellersProducts(page = 0, size = 100) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const url = `${this.gatewayUrl}/integration/product/sellers/${this.creds.supplierId}/products?approvedPage=${page}&size=${size}`;
        const response = await fetch(url, {
            headers: this.getHeaders()
        });

        if (!response.ok) throw new Error(`Trendyol API Error: ${response.statusText}`);
        return await response.json();
    }

    /**
     * Get Shipping Labels
     * GET /integration/order/sellers/{sellerId}/shipping-labels/{cargoTrackingNumbers}
     */
    async getShippingLabels(cargoTrackingNumber: string) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const url = `${this.gatewayUrl}/integration/order/sellers/${this.creds.supplierId}/shipping-labels/${cargoTrackingNumber}`;
        const response = await fetch(url, {
            headers: this.getHeaders()
        });

        if (!response.ok) throw new Error(`Trendyol API Error: ${response.statusText}`);
        return await response.json();
    }

    /**
     * Get Common Label (Trendyol Agreed Carriers)
     * GET /integration/sellers/{sellerId}/common-label/query?id={cargoTrackingNumber}
     */
    async getCommonLabel(cargoTrackingNumber: string) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const url = `${this.gatewayUrl}/integration/sellers/${this.creds.supplierId}/common-label/query?id=${cargoTrackingNumber}`;
        const response = await fetch(url, {
            headers: this.getHeaders()
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Trendyol Common Label Error: ${response.status} - ${errText}`);
        }
        return await response.json(); 
    }

    /**
     * Get International Label (DHL etc.)
     * GET /integration/sellers/{sellerId}/international-label/query?id={shipmentPackageId}
     */
    async getInternationalLabel(shipmentPackageId: string) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const url = `${this.gatewayUrl}/integration/sellers/${this.creds.supplierId}/international-label/query?id=${shipmentPackageId}`;
        const response = await fetch(url, {
            headers: this.getHeaders()
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Trendyol International Label Error: ${response.status} - ${errText}`);
        }
        return await response.json(); 
    }

    /**
     * Create Common Label (Batch)
     * POST /integration/sellers/{sellerId}/common-label
     */
    async createCommonLabel(shipmentPackageIds: string[]) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const url = `${this.gatewayUrl}/integration/sellers/${this.creds.supplierId}/common-label`;
        const response = await fetch(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({ shipmentPackageIds })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Trendyol Create Label Error: ${response.status} - ${errText}`);
        }
        return await response.json();
    }
}
