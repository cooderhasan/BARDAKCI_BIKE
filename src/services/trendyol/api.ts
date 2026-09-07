
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

    public getHeaders(): Record<string, string> {
        if (!this.creds) throw new Error("Client not initialized.");
        const pair = `${this.creds.apiKey}:${this.creds.apiSecret}`;
        return {
            "Authorization": `Basic ${Buffer.from(pair).toString("base64").trim()}`,
            "User-Agent": `${this.creds.supplierId} - SelfIntegration`,
            "Content-Type": "application/json",
            "Accept": "application/json, application/pdf",
            "storeFrontCode": "TR"
        };
    }

    /**
     * Test connection with detailed error reporting
     * Uses the V2 endpoint: GET /integration/product/sellers/{sellerId}/products/approved?size=1
     */
    async checkConnectionDetailed(): Promise<{ success: boolean; message: string }> {
        try {
            await this.init();
            if (!this.creds) return { success: false, message: "Ayarlar yüklenemedi." };

            const response = await fetch(`${this.gatewayUrl}/integration/product/sellers/${this.creds.supplierId}/products/approved?size=1`, {
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
     * Create Products (Bulk) - V2
     * POST /integration/product/sellers/{sellerId}/v2/products
     */
    async createProducts(items: any[]) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const url = `${this.gatewayUrl}/integration/product/sellers/${this.creds.supplierId}/v2/products`;

        const response = await fetch(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({ items })
        });

        const data = await response.json();
        return { ok: response.ok, ...data };
    }

    /**
     * Update Approved Product Content (Bulk) - V2
     * POST /integration/product/sellers/{sellerId}/products/content-bulk-update
     */
    async updateApprovedProductContent(items: {
        contentId: number;
        title?: string;
        description?: string;
        images?: { url: string }[];
        attributes?: { attributeId: number; attributeValueId?: number; customAttributeValue?: string }[];
    }[]) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const url = `${this.gatewayUrl}/integration/product/sellers/${this.creds.supplierId}/products/content-bulk-update`;

        const response = await fetch(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({ items })
        });

        const data = await response.json();
        return { ok: response.ok, ...data };
    }

    /**
     * Update Unapproved Products (Bulk) - V2
     * POST /integration/product/sellers/{sellerId}/products/unapproved-bulk-update
     */
    async updateUnapprovedProducts(items: any[]) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const url = `${this.gatewayUrl}/integration/product/sellers/${this.creds.supplierId}/products/unapproved-bulk-update`;

        const response = await fetch(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({ items })
        });

        const data = await response.json();
        return { ok: response.ok, ...data };
    }

    /**
     * Update Price and Inventory (V1-V2 Ortak)
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
     * Get Attributes for a Category - V2
     * GET /integration/product/categories/{categoryId}/attributes
     */
    async getCategoryAttributes(categoryId: number) {
        await this.init();
        const response = await fetch(`${this.gatewayUrl}/integration/product/categories/${categoryId}/attributes`, {
            headers: this.getHeaders()
        });
        if (!response.ok) throw new Error(`Trendyol API Error: ${response.statusText}`);
        return await response.json();
    }

    /**
     * Get Attribute Values for a Category - V2
     * GET /integration/product/categories/{categoryId}/attributes/{attributeId}/values
     */
    async getCategoryAttributeValues(categoryId: number, attributeId: number, size: number = 1000) {
        await this.init();
        const response = await fetch(`${this.gatewayUrl}/integration/product/categories/${categoryId}/attributes/${attributeId}/values?size=${size}`, {
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

        const cargoCompanyId = 10; // Default MNG (usually 10 or 11)
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
     * Get Seller's Approved Products from Trendyol - V2
     * GET /integration/product/sellers/{sellerId}/products/approved
     */
    async getSellersProducts(page = 0, size = 100, barcode?: string) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        let url = `${this.gatewayUrl}/integration/product/sellers/${this.creds.supplierId}/products/approved?page=${page}&size=${size}`;
        if (barcode) {
            url += `&barcode=${encodeURIComponent(barcode)}`;
        }
        const response = await fetch(url, {
            headers: this.getHeaders()
        });

        if (!response.ok) throw new Error(`Trendyol API Error: ${response.statusText}`);
        const data = await response.json();

        // V2 normalization: flatten variants if present so existing UI and importers work seamlessly
        if (data && Array.isArray(data.content)) {
            const normalizedContent: any[] = [];
            for (const item of data.content) {
                if (Array.isArray(item.variants) && item.variants.length > 0) {
                    for (const v of item.variants) {
                        normalizedContent.push({
                            ...item,
                            contentId: item.contentId,
                            productMainId: item.productMainId,
                            title: item.title,
                            barcode: v.barcode || item.barcode,
                            stockCode: v.stockCode || item.stockCode,
                            salePrice: v.salePrice ?? item.salePrice,
                            listPrice: v.listPrice ?? item.listPrice,
                            quantity: v.quantity ?? item.quantity,
                            attributes: v.attributes || item.attributes,
                            images: (item.images && item.images.length > 0) ? item.images : (v.images || []),
                            rawVariant: v
                        });
                    }
                } else {
                    normalizedContent.push(item);
                }
            }
            return {
                ...data,
                content: normalizedContent
            };
        }

        return data;
    }

    /**
     * Get Seller's Unapproved Products from Trendyol - V2
     * GET /integration/product/sellers/{sellerId}/products/unapproved
     */
    async getSellersUnapprovedProducts(page = 0, size = 100) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const url = `${this.gatewayUrl}/integration/product/sellers/${this.creds.supplierId}/products/unapproved?page=${page}&size=${size}`;
        const response = await fetch(url, {
            headers: this.getHeaders()
        });

        if (!response.ok) throw new Error(`Trendyol API Error: ${response.statusText}`);
        return await response.json();
    }

    /**
     * Get Single Product Basic Info by Barcode - V2
     * GET /integration/product/sellers/{sellerId}/product/{barcode}
     */
    async getProductByBarcode(barcode: string) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const url = `${this.gatewayUrl}/integration/product/sellers/${this.creds.supplierId}/product/${encodeURIComponent(barcode)}`;
        const response = await fetch(url, {
            headers: this.getHeaders()
        });

        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`Trendyol API Error: ${response.statusText}`);
        }
        return await response.json();
    }

    /**
     * Get Batch Request Status - V2
     * GET /integration/product/sellers/{sellerId}/products/batch-requests/{batchRequestId}
     */
    async getBatchRequestResult(batchRequestId: string) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        let url = `${this.gatewayUrl}/integration/product/sellers/${this.creds.supplierId}/products/batch-requests/${batchRequestId}`;
        let response = await fetch(url, {
            headers: this.getHeaders()
        });

        if (response.status === 404) {
            // Fallback: Inventory API
            url = `${this.gatewayUrl}/integration/inventory/sellers/${this.creds.supplierId}/products/batch-requests/${batchRequestId}`;
            response = await fetch(url, {
                headers: this.getHeaders()
            });
        }

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
    async getCommonLabel(id: string, format: "PDF" | "ZPL" = "PDF") {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const url = `${this.gatewayUrl}/integration/sellers/${this.creds.supplierId}/common-label/query?id=${id}&format=${format}`;
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
    async getInternationalLabel(shipmentPackageId: string, format: "PDF" | "ZPL" = "PDF") {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const url = `${this.gatewayUrl}/integration/sellers/${this.creds.supplierId}/international-label/query?id=${shipmentPackageId}&format=${format}`;
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

    /**
     * Create Common Label (Single - Using Tracking Number)
     * POST /integration/sellers/{sellerId}/common-label/{cargoTrackingNumber}
     */
    async createCommonLabelSingle(cargoTrackingNumber: string) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const url = `${this.gatewayUrl}/integration/sellers/${this.creds.supplierId}/common-label/${cargoTrackingNumber}`;
        const response = await fetch(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({ format: "ZPL" })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Trendyol Create Label Single Error: ${response.status} - ${errText}`);
        }
        return await response.json();
    }

    /**
     * Get Common Label (Single - Using Tracking Number)
     * GET /integration/sellers/{sellerId}/common-label/{cargoTrackingNumber}
     */
    async getCommonLabelSingle(cargoTrackingNumber: string) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const url = `${this.gatewayUrl}/integration/sellers/${this.creds.supplierId}/common-label/${cargoTrackingNumber}`;
        const response = await fetch(url, {
            headers: this.getHeaders()
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Trendyol Get Label Single Error: ${response.status} - ${errText}`);
        }
        return await response.json();
    }

    /**
     * Get Customer Questions from Trendyol
     * GET /integration/qna/sellers/{sellerId}/questions/filter
     */
    async getQuestions(params: {
        barcode?: string;
        page?: number;
        size?: number;
        status?: "WAITING_FOR_ANSWER" | "ANSWERED" | "REJECTED" | "UNANSWERED";
        startDate?: number;
        endDate?: number;
    } = {}) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const queryParams = new URLSearchParams();
        if (params.barcode) queryParams.append("barcode", params.barcode);
        if (params.page !== undefined) queryParams.append("page", params.page.toString());
        if (params.size !== undefined) queryParams.append("size", params.size.toString());
        if (params.status) queryParams.append("status", params.status);
        if (params.startDate) queryParams.append("startDate", params.startDate.toString());
        if (params.endDate) queryParams.append("endDate", params.endDate.toString());

        const url = `${this.gatewayUrl}/integration/qna/sellers/${this.creds.supplierId}/questions/filter?${queryParams.toString()}`;
        const response = await fetch(url, {
            headers: this.getHeaders()
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Trendyol Questions API Error: ${errorData.message || response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Answer a Customer Question
     * POST /integration/qna/sellers/{sellerId}/questions/{id}/answers
     */
    async answerQuestion(questionId: string | number, text: string) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const url = `${this.gatewayUrl}/integration/qna/sellers/${this.creds.supplierId}/questions/${questionId}/answers`;
        const response = await fetch(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Trendyol Answer API Error: ${errorData.message || response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Send Invoice Link to Trendyol
     * POST /integration/sellers/{sellerId}/seller-invoice-links
     */
    async uploadInvoiceLink(shipmentPackageId: string | number, invoiceLink: string, invoiceNumber?: string) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const primaryUrl = `${this.gatewayUrl}/integration/sellers/${this.creds.supplierId}/seller-invoice-links`;
        const payload: any = {
            invoiceLink,
            shipmentPackageId: Number(shipmentPackageId) || shipmentPackageId
        };
        if (invoiceNumber) {
            payload.invoiceNumber = invoiceNumber;
            payload.invoiceDateTime = Date.now();
        }

        let response = await fetch(primaryUrl, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(payload)
        });

        // Fallback to legacy endpoint if primary fails
        if (!response.ok && (response.status === 404 || response.status === 556 || response.status === 503)) {
            const fallbackUrl = `${this.gatewayUrl}/integration/seller-order/send-invoice-link`;
            const fallbackRes = await fetch(fallbackUrl, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({
                    invoiceLink,
                    shipmentPackageId: Number(shipmentPackageId) || shipmentPackageId
                })
            });
            if (fallbackRes.ok) {
                response = fallbackRes;
            }
        }

        if (!response.ok) {
            const errText = await response.text();
            if (response.status === 409 && (errText.includes("already exist") || errText.includes("already exists"))) {
                console.log("ℹ️ Trendyol 409: Fatura linki önceden kayıtlı. Eski link silinip yeni link gönderiliyor...");
                await this.deleteInvoiceLink(shipmentPackageId).catch(() => {});
                const retryRes = await fetch(primaryUrl, {
                    method: "POST",
                    headers: this.getHeaders(),
                    body: JSON.stringify(payload)
                });
                if (retryRes.ok) {
                    const retryText = await retryRes.text();
                    try { return retryText ? JSON.parse(retryText) : { success: true }; } catch { return { success: true }; }
                }
                return { success: true, alreadyExists: true, message: "Fatura linki Trendyol'da zaten kayıtlı." };
            }
            throw new Error(`Trendyol Fatura Linki Gönderim Hatası (${response.status}): ${errText}`);
        }

        const text = await response.text();
        try {
            return text ? JSON.parse(text) : { success: true };
        } catch {
            return { success: true };
        }
    }

    /**
     * Delete Invoice Link on Trendyol
     * POST /integration/sellers/{sellerId}/seller-invoice-links/delete
     */
    async deleteInvoiceLink(shipmentPackageId: string | number, customerId?: number | string) {
        await this.init();
        if (!this.creds) throw new Error("No creds");

        const pkgId = Number(shipmentPackageId) || shipmentPackageId;
        const url = `${this.gatewayUrl}/integration/sellers/${this.creds.supplierId}/seller-invoice-links/delete`;
        const response = await fetch(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({
                serviceSourceId: pkgId,
                shipmentPackageId: pkgId,
                channelId: 1,
                customerId: Number(customerId) || 1
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.warn(`Trendyol fatura linki silme uyarısı (${response.status}): ${errText}`);
        } else {
            console.log(`✅ Trendyol eski fatura linki silindi (PackageId: ${pkgId}).`);
        }

        return true;
    }
}
