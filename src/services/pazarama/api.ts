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
  private tokenUrl: string;
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(config: PazaramaConfig) {
    this.config = config;
    this.baseUrl = config.isTestMode
      ? "https://stage-isortagimapi.pazarama.com"
      : "https://isortagimapi.pazarama.com";
    this.tokenUrl = config.isTestMode
      ? "https://stage-isortagimgiris.pazarama.com/connect/token"
      : "https://isortagimgiris.pazarama.com/connect/token";
  }

  /**
   * Fetch OAuth2 Access Token from Pazarama Auth Server
   */
  async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.token;
    }

    const apiKey = (this.config.apiKey || "").trim();
    const apiSecret = (this.config.apiSecret || "").trim();

    if (!apiKey || !apiSecret) {
      throw new Error("API Key (Client ID) ve API Secret (Client Secret) girilmelidir.");
    }

    const basicAuth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

    // Standard Pazarama API OAuth2 IdentityServer payload
    const bodyParams = new URLSearchParams({
      grant_type: "client_credentials",
      scope: "merchantgatewayapi.fullaccess",
    });

    const response = await fetch(this.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: bodyParams.toString(),
      cache: "no-store",
    });

    const responseText = await response.text().catch(() => "");

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Pazarama yetkilendirme hatası (HTTP ${response.status}). API Key (Client ID) veya Secret yanlış.`
        );
      }
      throw new Error(
        `Pazarama Token Alınamadı (HTTP ${response.status}): ${responseText || response.statusText}`
      );
    }

    let data: any = {};
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`Pazarama yanıtı JSON formatında değil: ${responseText.substring(0, 100)}`);
    }

    // Extract token from Pazarama API response ({ success: true, data: { accessToken: "..." } })
    const token =
      data?.data?.accessToken ||
      data?.data?.access_token ||
      data?.accessToken ||
      data?.access_token ||
      data?.result?.accessToken ||
      data?.result?.access_token ||
      data?.token;

    const expiresIn =
      data?.data?.expiresIn ||
      data?.data?.expires_in ||
      data?.expires_in ||
      data?.expiresIn ||
      3600;

    if (!token) {
      throw new Error(
        `Pazarama Token yanıtında access_token bulunamadı. Gelen Cevap: ${responseText.substring(0, 150)}`
      );
    }

    this.cachedToken = {
      token,
      expiresAt: Date.now() + (expiresIn - 300) * 1000,
    };

    return token;
  }

  /**
   * Helper for Authorized HTTP Headers
   */
  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
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
      const token = await this.getAccessToken();
      if (!token) {
        return { success: false, message: "Pazarama Access Token alınamadı." };
      }

      return {
        success: true,
        message: "✅ Pazarama API Bağlantısı Başarılı! Access Token başarıyla alındı.",
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Bağlantı hatası: ${error.message || "Pazarama sunucusuna ulaşılamadı."}`,
      };
    }
  }

  /**
   * Fetch Pazarama category tree with multi-endpoint fallback
   */
  async getCategories(): Promise<PazaramaCategory[]> {
    try {
      const headers = await this.getHeaders();
      const endpoints = [
        `${this.baseUrl}/category/get-categories`,
        `${this.baseUrl}/api/v1/category/get-categories`,
        `${this.baseUrl}/category/getCategories`,
        `${this.baseUrl}/api/v1/category/getCategories`,
        `${this.baseUrl}/category/get-all-categories`,
        `${this.baseUrl}/api/v1/category/getCategoryWithAttributes`,
        `${this.baseUrl}/category/getCategoryWithAttributes`,
      ];

      for (const endpoint of endpoints) {
        for (const method of ["GET", "POST"]) {
          try {
            const res = await fetch(endpoint, {
              method,
              headers,
              ...(method === "POST" ? { body: JSON.stringify({}) } : {}),
              cache: "no-store",
            });

            if (!res.ok) continue;

            const data = await res.json();
            const list =
              data?.data?.categories ||
              data?.data ||
              data?.result?.categories ||
              data?.result ||
              (Array.isArray(data) ? data : null);

            if (Array.isArray(list) && list.length > 0) {
              return list as PazaramaCategory[];
            }
          } catch (e) {
            // try next method/endpoint
          }
        }
      }

      return [];
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
      const headers = await this.getHeaders();
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

      const res = await fetch(`${this.baseUrl}/api/v1/product/createProduct`, {
        method: "POST",
        headers,
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
      const headers = await this.getHeaders();
      const payload = {
        items: items.map((i) => ({
          code: i.code,
          stockQuantity: i.stock,
          salePrice: i.price,
        })),
      };

      const res = await fetch(`${this.baseUrl}/api/v1/product/updatePriceAndStock`, {
        method: "POST",
        headers,
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
      const headers = await this.getHeaders();
      const res = await fetch(`${this.baseUrl}/api/v1/order/getOrders`, {
        method: "GET",
        headers,
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
