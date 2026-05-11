
import { prisma } from "@/lib/db";

interface N11Creds {
    apiKey: string;
    apiSecret: string;
}

export class N11Client {
    private baseUrl = "https://api.n11.com"; // Base URL changed to main domain
    private creds: N11Creds | null = null;

    constructor(creds?: N11Creds) {
        if (creds) {
            this.creds = creds;
        }
    }

    async init() {
        if (this.creds) return;
        const config = await (prisma as any).n11Config.findFirst({ where: { isActive: true } });
        if (!config) throw new Error("Aktif N11 yapılandırması bulunamadı.");
        this.creds = { apiKey: config.apiKey, apiSecret: config.apiSecret };
    }

    private getHeaders() {
        if (!this.creds) throw new Error("Creds missing");
        return {
            "appKey": this.creds.apiKey,
            "appSecret": this.creds.apiSecret,
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
    }

    private async asyncTimeoutFetch(url: string, options: RequestInit, timeoutMs = 15000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            return await fetch(url, {
                ...options,
                signal: controller.signal
            });
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error("N11 servisi zaman aşımına uğradı (15s).");
            }
            if (error.message === 'fetch failed') {
                throw new Error("N11 servis bağlantı hatası (Servis şu an kararsız veya ulaşılamıyor).");
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private async callRest(endpoint: string, method = "GET", body?: any, retries = 2) {
        if (!this.creds) await this.init();

        // Remove double slashes if any
        const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
        const url = `${this.baseUrl}${cleanEndpoint}`;
        console.log(`N11 API Request: [${method}] ${url}`);
        
        const options: RequestInit = {
            method,
            headers: this.getHeaders(),
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        let lastError: any;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (attempt > 0) {
                    console.log(`N11 API Retry [${method}] ${url} - Attempt ${attempt + 1}/${retries + 1}`);
                    await new Promise(r => setTimeout(r, 1000 * attempt));
                }

                const response = await this.asyncTimeoutFetch(url, options);
                
                // If we got a response but it's not JSON (e.g. 503 HTML), handle gracefully
                const contentType = response.headers.get("content-type");
                const text = await response.text();

                if (!contentType || !contentType.includes("application/json")) {
                    if (response.status >= 500) {
                        throw new Error(`N11 Sunucu Hatası (${response.status}): Servis geçici olarak servis dışı.`);
                    }
                    throw new Error(`N11 Beklenmedik Yanıt (${response.status}): JSON formatı bekleniyordu.`);
                }

                let data;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    throw new Error("N11 API yanıtı JSON formatında değil.");
                }

                if (!response.ok) {
                    console.error(`N11 API Error Response [${endpoint}]:`, JSON.stringify(data));
                    const errorDetail = data.errors?.[0]?.message || data.message || data.errorDescription || `HTTP ${response.status}`;
                    throw new Error(`N11 API Hatası: ${errorDetail}`);
                }

                return data;
            } catch (fetchError: any) {
                lastError = fetchError;
                console.error(`N11 Fetch Exception [${url}] (Attempt ${attempt + 1}):`, fetchError.message);
                
                // Don't retry on 4xx errors (client errors)
                if (fetchError.message?.includes('HTTP 4')) {
                    throw fetchError;
                }
            }
        }

        throw lastError;
    }


    /**
     * Test connection using GetCategories as per doc
     */
    async checkConnectionDetailed(): Promise<{ success: boolean; message: string }> {
        try {
            await this.init();
            // Use /cdn/categories - official doc says it returns a raw array
            const data = await this.callRest("/cdn/categories");
            
            // If it's a raw array or contains categories, it's a success
            if (Array.isArray(data)) {
                if (data.length > 0) {
                    return { success: true, message: "Bağlantı Başarılı" };
                }
                return { success: false, message: "Bağlantı başarılı ancak N11 boş liste döndürdü." };
            }
            
            // Fallback for object wrapping
            if (data && typeof data === "object" && (data.categories || data.content)) {
                return { success: true, message: "Bağlantı Başarılı" };
            }
            
            return { success: false, message: "N11'den geçersiz veri yapısı alındı." };
        } catch (error: any) {
            // Detailed error reporting for the user
            return { success: false, message: "Bağlantı Hatası: " + error.message };
        }
    }

    // --- Order Service ---

    async getOrders(status: "Created" | "Picking" | "Shipped" | "Delivered" | "Cancelled" = "Created") {
        try {
            // Updated to official endpoint: /rest/delivery/v1/shipmentPackages
            const data = await this.callRest(`/rest/delivery/v1/shipmentPackages?status=${status}&size=100&orderByDirection=DESC`);
            return { success: true, ...data };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Approves an order by its line IDs
     * Official Doc: PUT https://api.n11.com/rest/order/v1/update
     */
    async acceptOrder(lineIds: number[]) {
        try {
            const payload = {
                lines: lineIds.map(id => ({ lineId: id })),
                status: "Picking"
            };
            const data = await this.callRest("/rest/order/v1/update", "PUT", payload);
            return { success: true, data };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    // --- Category Service ---

    async getTopLevelCategories() {
        try {
            // Official Doc: GET https://api.n11.com/cdn/categories
            const data = await this.callRest("/cdn/categories");
            
            // Robust check: doc says raw array, but let's handle object wrapping too
            let categories = [];
            if (Array.isArray(data)) {
                categories = data;
            } else if (data && Array.isArray(data.categories)) {
                categories = data.categories;
            } else if (data && Array.isArray(data.content)) {
                categories = data.content;
            }

            return { success: true, categories };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async getSubCategories(categoryId: number) {
        // Since GetCategories returns the whole tree, we might not need this,
        // but keeping a placeholder for consistency if needed.
        return { success: false, message: "N11 REST API tüm ağacı tek seferde döndürür." };
    }

    async getAllCategories() {
        try {
            const categories = await this.getTopLevelCategories();
            if (!categories.success) return categories;

            const flatList: any[] = [];
            const traverse = (cats: any[], path = "") => {
                if (!Array.isArray(cats)) return; // Safety check
                for (const cat of cats) {
                    const currentPath = path ? `${path} > ${cat.name}` : cat.name;
                    if (!cat.subCategories || !Array.isArray(cat.subCategories) || cat.subCategories.length === 0) {
                        flatList.push({ id: cat.id, name: currentPath });
                    } else {
                        traverse(cat.subCategories, currentPath);
                    }
                }
            };

            traverse(categories.categories);
            return { success: true, categories: flatList };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async getCategoryAttributes(categoryId: number) {
        try {
            // Official Doc: GET https://api.n11.com/cdn/category/{categoryId}/attribute
            const data = await this.callRest(`/cdn/category/${categoryId}/attribute`);
            
            // Log raw response to help debug
            console.log("N11 RAW categoryAttributes sample:", JSON.stringify((data.categoryAttributes || [])[0], null, 2));
            
            const attributes = (data.categoryAttributes || []).map((attr: any) => {
                // SOAP doc says 'valueList', REST might say 'attributeValues' or 'values'
                const rawValues = attr.valueList?.value || attr.attributeValues || attr.values || [];
                
                return {
                    id: attr.attributeId || attr.id,
                    name: attr.attributeName || attr.name,
                    mandatory: attr.isMandatory === true || attr.mandatory === true,
                    values: rawValues.map((v: any) => {
                        if (typeof v === 'string') return v;
                        // Doc says 'name' inside 'value'
                        return v.name ?? v.attributeValue ?? v.value ?? v.label ?? JSON.stringify(v);
                    }).filter(Boolean)
                };
            });
            
            return { success: true, attributes };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    // --- Product Service (Tasks) ---

    async updateStockAndPrice(skus: any[]) {
        try {
            // Official Doc: POST https://api.n11.com/ms/product/tasks/price-stock-update
            const payload = {
                payload: {
                    integrator: "SRN_Entegrasyon",
                    skus: skus.map(s => ({
                        ...s,
                        salePrice: s.salePrice ? Number(s.salePrice).toFixed(2) : undefined,
                        listPrice: s.listPrice ? Number(s.listPrice).toFixed(2) : undefined
                    }))
                }
            };
            const data = await this.callRest("/ms/product/tasks/price-stock-update", "POST", payload);
            return { success: true, taskId: data.id };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async saveProduct(product: any) {
        try {
            // Official Doc: POST https://api.n11.com/ms/product/tasks/product-create
            // Build SKU object(s) according to official REST API documentation
            
            // Helper to build a single SKU object
            const buildSku = (skuData: any): any => {
                const sku: any = {
                    title: skuData.title,
                    description: skuData.description,
                    categoryId: skuData.categoryId,
                    currencyType: skuData.currencyType || "TL",
                    productMainId: skuData.productMainId || skuData.sellerCode || skuData.stockCode,
                    preparingDay: skuData.preparingDay ?? 3,
                    shipmentTemplate: skuData.shipmentTemplate || "Karaaslan",
                    stockCode: skuData.stockCode || skuData.sellerCode,
                    salePrice: skuData.salePrice != null ? Number(skuData.salePrice).toFixed(2) : null,
                    listPrice: skuData.listPrice != null ? Number(skuData.listPrice).toFixed(2) : null,
                    vatRate: skuData.vatRate ?? 20,
                    quantity: skuData.quantity || 0,
                    images: (skuData.images || []).slice(0, 8).map((url: string, index: number) => ({
                        url: url,
                        order: index + 1
                    })),
                    // REST API attributes: id + valueId/customValue (NOT name/value)
                    // Filter out attributes without id - N11 requires id for each attribute
                    attributes: (skuData.attributes || [])
                        .filter((attr: any) => attr.id != null && attr.id !== '')
                        .map((attr: any) => ({
                            id: attr.id,
                            valueId: attr.valueId ?? null,
                            customValue: attr.customValue ?? null
                        }))
                };

                // Optional fields - only add if provided
                if (skuData.subtitle) {
                    sku.subtitle = skuData.subtitle;
                }
                if (skuData.barcode) {
                    sku.barcode = skuData.barcode;
                }
                if (skuData.catalogId) {
                    sku.catalogId = skuData.catalogId;
                }
                if (skuData.maxPurchaseQuantity) {
                    sku.maxPurchaseQuantity = skuData.maxPurchaseQuantity;
                }

                return sku;
            };

            let skus: any[];
            
            // Check if multiple SKUs are provided (variant products)
            if (product._skus && Array.isArray(product._skus) && product._skus.length > 0) {
                // Variant product: multiple SKUs with same productMainId
                skus = product._skus.map((variantSku: any) => buildSku(variantSku));
            } else {
                // Single product
                skus = [buildSku(product)];
            }

            const payload = {
                payload: {
                    integrator: product.integrator || "SRN_Entegrasyon",
                    skus: skus
                }
            };
            
            console.log("N11 SaveProduct Payload (Official REST):", JSON.stringify(payload, null, 2));
            const data = await this.callRest("/ms/product/tasks/product-create", "POST", payload);
            return { success: true, taskId: data.id, type: data.type, status: data.status, reasons: data.reasons };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async getTaskDetails(taskId: string) {
        try {
            // New Official Doc: POST https://api.n11.com/ms/product/task-details/page-query
            const payload = {
                taskId: Number(taskId),
                pageable: {
                    page: 0,
                    size: 10
                }
            };
            const response = await this.callRest("/ms/product/task-details/page-query", "POST", payload);
            console.log(`N11 Full Response [${taskId}]:`, JSON.stringify(response));
            
            // Aggressively search for the items array in N11's varied response structures
            let items = [];
            if (response.skus && Array.isArray(response.skus.content)) {
                items = response.skus.content;
            } else if (Array.isArray(response.content)) {
                items = response.content;
            } else if (Array.isArray(response.items)) {
                items = response.items;
            }
            
            // Deep status search
            let status = response.status || response.state || response.taskStatus || response.result;
            
            // If main status is missing, check items
            if (!status && items.length > 0) {
                status = items[0].status || items[0].state || items[0].result;
            }

            // Still missing? Default to PENDING
            status = status || "PENDING";
            
            const data = {
                status: status,
                items: items,
                raw: response // Include raw for debugging if needed
            };

            console.log(`N11 Task Status Check [${taskId}]:`, status);
            return { success: true, data };
        } catch (error: any) {
            console.error(`N11 Task Status Error [${taskId}]:`, error.message);
            return { success: false, message: error.message };
        }
    }

    /**
     * Fallback for when REST polling is down.
     * Checks if a product exists on N11 using the SOAP API.
     */
    async getProductBySellerCode(sellerCode: string) {
        if (!this.creds) await this.init();
        
        const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sch="http://www.n11.com/ws/schemas">
   <soapenv:Header/>
   <soapenv:Body>
      <sch:GetProductBySellerCodeRequest>
         <auth>
            <appKey>${this.creds!.apiKey}</appKey>
            <appSecret>${this.creds!.apiSecret}</appSecret>
         </auth>
         <sellerCode>${sellerCode}</sellerCode>
      </sch:GetProductBySellerCodeRequest>
   </soapenv:Body>
</soapenv:Envelope>`;

        try {
            const response = await fetch("https://api.n11.com/ws/productService/", {
                method: "POST",
                headers: {
                    "Content-Type": "text/xml;charset=UTF-8",
                    "SOAPAction": ""
                },
                body: soapEnvelope
            });
            
            const text = await response.text();
            
            if (text.includes("<status>success</status>")) {
                // Product found and active
                return { success: true, exists: true, data: text };
            }
            
            if (text.includes("ürün bulunamadı") || text.includes("notFound")) {
                return { success: true, exists: false };
            }

            return { success: false, message: "SOAP API Hatası" };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }
}


