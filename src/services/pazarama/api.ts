import {
  PazaramaConfig,
  PazaramaCategory,
  PazaramaProductInput,
  PazaramaBatchResult,
  PazaramaOrder,
} from "./types";

export class PazaramaClient {
  private config: PazaramaConfig;
  private baseUrl: string;

  constructor(config: PazaramaConfig) {
    this.config = config;
    this.baseUrl = config.isTestMode
      ? "https://stage-api.pazarama.com"
      : "https://api.pazarama.com";
  }

  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "BardakciBike-PazaramaIntegration/1.0",
      "X-Api-Key": this.config.apiKey || "",
      "X-Api-Secret": this.config.apiSecret || "",
      ...(this.config.merchantId ? { "X-Merchant-Id": this.config.merchantId } : {}),
    };
  }

  /**
   * Test API Credentials connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.config.apiKey || !this.config.apiSecret) {
      return { success: false, message: "API Key ve API Secret zorunludur." };
    }

    try {
      // Endpoint for health / category check
      const res = await fetch(`${this.baseUrl}/api/category/get-categories`, {
        method: "GET",
        headers: this.getHeaders(),
        next: { revalidate: 0 },
      });

      if (res.ok || res.status === 401) {
        if (res.status === 401) {
          return { success: false, message: "Geçersiz API Anahtarı veya Secret." };
        }
        return { success: true, message: "Pazarama API bağlantısı başarılı." };
      }

      return {
        success: false,
        message: `API Yanıt Verdi (${res.status}): ${res.statusText}`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Bağlantı hatası: ${error.message || "Sunucuya ulaşılamadı"}`,
      };
    }
  }

  /**
   * Fetch Pazarama category tree
   */
  async getCategories(): Promise<PazaramaCategory[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/category/get-categories`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!res.ok) return [];

      const data = await res.json();
      return (data?.result || data?.data || []) as PazaramaCategory[];
    } catch (error) {
      console.error("Pazarama getCategories error:", error);
      return [];
    }
  }

  /**
   * Create / Upload product batch
   */
  async createProductBatch(
    products: PazaramaProductInput[]
  ): Promise<PazaramaBatchResult> {
    try {
      const payload = {
        items: products.map((p) => ({
          code: p.code,
          title: p.title,
          description: p.description,
          barcode: p.barcode,
          brandId: p.brandId,
          categoryId: p.categoryId,
          listPrice: p.listPrice,
          salePrice: p.salePrice,
          stockQuantity: p.stockQuantity,
          vatRate: p.vatRate,
          images: p.images,
          attributes: p.attributes,
        })),
      };

      const res = await fetch(`${this.baseUrl}/api/product/create-products`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          error: `Pazarama Ürün Gönderim Hatası (${res.status}): ${errorText}`,
        };
      }

      const data = await res.json();
      return {
        success: true,
        batchId: data?.batchRequestId || data?.result?.batchRequestId || "BATCH-" + Date.now(),
        message: "Ürünler Pazarama'ya başarıyla gönderildi.",
      };
    } catch (error: any) {
      return {
        success: false,
        error: `İstek hatası: ${error.message || "Bağlantı kurulamadı"}`,
      };
    }
  }

  /**
   * Update Stock & Price for product batch
   */
  async updateStockAndPrice(
    items: Array<{ code: string; stock: number; price: number }>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const payload = {
        items: items.map((i) => ({
          code: i.code,
          stockQuantity: i.stock,
          salePrice: i.price,
        })),
      };

      const res = await fetch(`${this.baseUrl}/api/product/update-price-and-inventory`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        return {
          success: false,
          message: `Stok/Fiyat Güncelleme Hatası (${res.status})`,
        };
      }

      return {
        success: true,
        message: `${items.length} adet ürünün stok ve fiyatı Pazarama'da güncellendi.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Güncelleme hatası: ${error.message}`,
      };
    }
  }

  /**
   * Fetch Pazarama Orders
   */
  async getOrders(): Promise<PazaramaOrder[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/order/get-orders`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!res.ok) return [];

      const data = await res.json();
      return (data?.result || data?.orders || []) as PazaramaOrder[];
    } catch (error) {
      console.error("Pazarama getOrders error:", error);
      return [];
    }
  }
}
