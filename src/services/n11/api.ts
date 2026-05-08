
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

    private async callRest(endpoint: string, method = "GET", body?: any) {
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

        try {
            const response = await fetch(url, options);
            const data = await response.json();

            if (!response.ok) {
                console.error(`N11 API Error Response [${endpoint}]:`, JSON.stringify(data));
                const errorDetail = data.errors?.[0]?.message || data.message || data.errorDescription || `HTTP ${response.status}`;
                throw new Error(`N11 API Hatası: ${errorDetail}`);
            }

            return data;
        } catch (fetchError: any) {
            console.error(`N11 Fetch Exception [${url}]:`, fetchError.message);
            throw fetchError;
        }
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
                    skus: skus
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
            const payload = {
                payload: {
                    integrator: "SRN_Entegrasyon",
                    skus: [{
                        title: product.title,
                        subtitle: product.title.substring(0, 50),
                        description: product.description,
                        categoryId: product.categoryId,
                        currencyType: "TL", 
                        preparingDay: 3,
                        shipmentTemplate: product.shipmentTemplate || "Karaaslan",
                        salePrice: product.price,
                        listPrice: product.price,
                        vatRate: 20,
                        quantity: product.quantity || 0,
                        productMainId: product.sellerCode,
                        stockCode: product.stockCode || product.sellerCode,
                        images: (product.images || []).slice(0, 8).map((url: string, index: number) => ({
                            url: url,
                            order: index + 1
                        })),
                        attributes: (product.attributes || []).map((attr: any) => ({
                            name: attr.name,
                            value: attr.value
                        }))
                    }]
                }
            };
            
            console.log("N11 SaveProduct Payload (Official REST):", JSON.stringify(payload, null, 2));
            const data = await this.callRest("/ms/product/tasks/product-create", "POST", payload);
            return { success: true, taskId: data.id };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async getTaskDetails(taskId: string) {
        try {
            // Official Doc: GET https://api.n11.com/ms/product/v1/tasks/{taskId}
            // "No Mapping" error suggests the version or path was missing
            const data = await this.callRest(`/ms/product/v1/tasks/${taskId}`);
            console.log(`N11 Task Status Check [${taskId}]:`, JSON.stringify(data));
            return { success: true, data };
        } catch (error: any) {
            console.error(`N11 Task Status Error [${taskId}]:`, error.message);
            return { success: false, message: error.message };
        }
    }
}
