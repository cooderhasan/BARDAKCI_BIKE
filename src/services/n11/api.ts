
import { prisma } from "@/lib/db";

interface N11Creds {
    apiKey: string;
    apiSecret: string;
}

export class N11Client {
    private baseUrl = "https://api.n11.com/rest";
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

        const url = `${this.baseUrl}${endpoint}`;
        const options: RequestInit = {
            method,
            headers: this.getHeaders(),
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `N11 API Hatası: ${response.status}`);
        }

        return data;
    }

    /**
     * Test connection with detailed error reporting
     */
    async checkConnectionDetailed(): Promise<{ success: boolean; message: string }> {
        try {
            await this.init();
            if (!this.creds) return { success: false, message: "Ayarlar yüklenemedi." };

            // Fetch top level categories as a connection test
            const data = await this.callRest("/categories");
            
            if (data.status === "success" || data.categories) {
                return { success: true, message: "Tamam" };
            }

            return { success: false, message: data.message || "Bilinmeyen N11 Hatası" };

        } catch (error: any) {
            return { success: false, message: "Bağlantı Kurulamadı: " + error.message };
        }
    }

    // --- Product Service ---

    async saveProduct(product: any) {
        try {
            const payload = {
                productSellerCode: product.sellerCode,
                title: product.title,
                subtitle: product.subtitle || "",
                description: product.description,
                category: {
                    id: product.categoryId
                },
                price: product.price,
                currencyType: "TL",
                images: product.images.map((url: string, index: number) => ({
                    url: url,
                    order: index + 1
                })),
                approvalStatus: 1,
                preparingDay: 3,
                stockItems: [{
                    quantity: product.quantity,
                    sellerStockCode: product.stockCode,
                    optionPrice: product.price
                }]
            };

            const data = await this.callRest("/products", "POST", payload);
            return { success: true, message: "Başarılı", data };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    // --- Stock/Price Update ---

    async updateStock(item: { sellerStockCode: string, quantity: number }) {
        try {
            const data = await this.callRest(`/products/stock/${item.sellerStockCode}`, "PUT", {
                quantity: item.quantity
            });
            return { success: true, data };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async updatePrice(item: { sellerStockCode: string, price: number }) {
        try {
            const data = await this.callRest(`/products/price/${item.sellerStockCode}`, "PUT", {
                price: item.price,
                currencyType: "TL"
            });
            return { success: true, data };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    // --- Order Service ---

    async getOrders(status = "New") {
        try {
            // N11 REST Order statuses: New, Approved, Rejected, Shipped, Delivered, Completed, Claimed, Lateness
            const data = await this.callRest(`/orders?status=${status}`);
            return { success: true, ...data };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async acceptOrder(orderId: string) {
        try {
            const data = await this.callRest(`/orders/${orderId}/accept`, "POST");
            return { success: true, data };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    // --- Category Service ---

    async getTopLevelCategories() {
        try {
            const data = await this.callRest("/categories");
            return { success: true, categories: data.categories || [] };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async getSubCategories(categoryId: number) {
        try {
            const data = await this.callRest(`/categories/${categoryId}/subcategories`);
            return { success: true, categories: data.subCategories || [] };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async getAllCategories() {
        try {
            const res = await this.getTopLevelCategories();
            if (!res.success) return res;

            const allCategories: any[] = [];
            
            const fetchRecursive = async (cats: any[], parentPath = "") => {
                for (const cat of cats) {
                    const fullPath = parentPath ? `${parentPath} > ${cat.name}` : cat.name;
                    allCategories.push({ id: cat.id, name: fullPath });
                    
                    // N11 usually marks leaf categories or we can check subCategories
                    // To keep it simple and avoid 1000s of requests, we might only fetch top 2 levels
                    // OR if the API supports a full tree, we use it.
                    // Assuming we need sub-requests for N11 REST:
                    if (cat.hasSubCategory) {
                         const sub = await this.getSubCategories(cat.id);
                         if (sub.success) {
                             await fetchRecursive(sub.categories, fullPath);
                         }
                    }
                }
            };

            await fetchRecursive(res.categories);
            return { success: true, categories: allCategories };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async getCategoryAttributes(categoryId: number) {
        try {
            const data = await this.callRest(`/categories/${categoryId}/attributes`);
            
            const attributes = (data.categoryAttributes || []).map((attr: any) => ({
                id: attr.id,
                name: attr.name,
                mandatory: attr.mandatory === true,
            }));
            
            return { success: true, attributes };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }
}
