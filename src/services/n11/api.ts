
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
        
        const options: RequestInit = {
            method,
            headers: this.getHeaders(),
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        const contentType = response.headers.get("content-type");

        let data: any;
        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        } else {
            const text = await response.text();
            throw new Error(`N11 API Beklenmedik Yanıt (${response.status}): ${text.substring(0, 100)}`);
        }

        if (!response.ok) {
            throw new Error(data.message || `N11 API Hatası: ${response.status}`);
        }

        return data;
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
                const rawValues = attr.attributeValues || attr.values || [];
                console.log(`Attr: ${attr.attributeName}, values sample:`, JSON.stringify(rawValues[0]));
                
                return {
                    id: attr.attributeId,
                    name: attr.attributeName,
                    mandatory: attr.isMandatory === true,
                    values: rawValues.map((v: any) => {
                        if (typeof v === 'string') return v;
                        // Try all possible field names N11 might use
                        return v.attributeValue ?? v.name ?? v.value ?? v.label ?? v.text ?? JSON.stringify(v);
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
                        description: product.description,
                        categoryId: product.categoryId,
                        currencyType: "TL",
                        productMainId: product.sellerCode,
                        preparingDay: 3,
                        shipmentTemplate: "STANDART",
                        quantity: product.quantity,
                        stockCode: product.stockCode,
                        images: product.images.map((url: string, index: number) => ({
                            url: url,
                            order: index
                        })),
                        attributes: product.attributes || [],
                        salePrice: product.price,
                        listPrice: product.price,
                        vatRate: 20
                    }]
                }
            };
            const data = await this.callRest("/ms/product/tasks/product-create", "POST", payload);
            return { success: true, taskId: data.id };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async getTaskDetails(taskId: string) {
        try {
            // Official Doc: GET https://api.n11.com/ms/product/tasks/{taskId}
            const data = await this.callRest(`/ms/product/tasks/${taskId}`);
            return { success: true, data };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }
}
