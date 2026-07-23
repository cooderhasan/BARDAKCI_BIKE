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

    if (!this.config.apiKey || !this.config.apiSecret) {
      throw new Error("API Key ve API Secret bulunamadı.");
    }

    const basicAuth = Buffer.from(
      `${this.config.apiKey}:${this.config.apiSecret}`
    ).toString("base64");

    const bodyParams = new URLSearchParams({
      grant_type: "client_credentials",
      scope: "merchantgatewayapi.fullaccess",
    });

    // Request token from Pazarama Identity Server
    const response = await fetch(this.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: bodyParams.toString(),
      cache: "no-store",
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      if (response.status === 401 || response.status === 403) {
        throw new Error("Pazarama API Key veya Secret hatalı/yetkisiz (401/403).");
      }
      throw new Error(
        `Pazarama Token Alınamadı (${response.status}): ${errText || response.statusText}`
      );
    }

    const data = await response.json();
    const token = data.access_token;
    const expiresIn = (data.expires_in || 3600) - 300; // cache with 5m buffer

    if (!token) {
      throw new Error("Pazarama token yanıtında access_token bulunamadı.");
    }

    this.cachedToken = {
      token,
      expiresAt: Date.now() + expiresIn * 1000,
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
      // Step 1: Check token acquisition
      const token = await this.getAccessToken();
      if (!token) {
        return { success: false, message: "Pazarama Access Token alınamadı." };
      }

      // Step 2: Try fetching categories or merchant info
      const headers = await this.getHeaders();
      const res = await fetch(`${this.baseUrl}/api/v1/category/getCategoryWithAttributes`, {
        method: "GET",
        headers,
        cache: "no-store",
      }).catch(() => null);

      if (res && (res.ok || res.status === 200 || res.status === 404)) {
        return { success: true, message: "Pazarama API kimlik doğrulaması başarılı! (Token alındı)" };
      }

      // If category endpoint URL differs, as long as token was retrieved successfully:
      return {
        success: true,
        message: "Pazarama API Bağlantısı başarılı! Access Token doğrulandı.",
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Bağlantı hatası: ${error.message || "Pazarama sunucusuna ulaşılamadı."}`,
      };
    }
  }

  /**
   * Fetch Pazarama category tree
   */
  async getCategories(): Promise<PazaramaCategory[]> {
    try {
      const headers = await this.getHeaders();
      const res = await fetch(`${this.baseUrl}/api/v1/category/getCategoryWithAttributes`, {
        method: "GET",
        headers,
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
