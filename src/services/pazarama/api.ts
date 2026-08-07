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
   * Fetch Pazarama category tree
   * Real endpoint from Pazarama docs: /category/getCategoryWithAttributes
   */
  async getCategories(): Promise<PazaramaCategory[]> {
    try {
      const headers = await this.getHeaders();
      const endpoints = [
        { url: `${this.baseUrl}/category/getCategoryWithAttributes`, method: "GET" },
        { url: `${this.baseUrl}/category/getCategoryWithAttributes`, method: "POST" },
        { url: `${this.baseUrl}/category/get-categories`, method: "GET" },
        { url: `${this.baseUrl}/category/get-categories`, method: "POST" },
        { url: `${this.baseUrl}/category/getCategories`, method: "GET" },
      ];

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep.url, {
            method: ep.method,
            headers,
            ...(ep.method === "POST" ? { body: JSON.stringify({}) } : {}),
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
          // try next endpoint
        }
      }

      return [];
    } catch (error) {
      console.error("Pazarama getCategories error:", error);
      return [];
    }
  }

  /**
   * Fetch Pazarama brand list
   */
  async getBrands(): Promise<Array<{ id: string; name: string }>> {
    try {
      const headers = await this.getHeaders();
      const endpoints = [
        { url: `${this.baseUrl}/brand/getBrands`, method: "GET" },
        { url: `${this.baseUrl}/brand/getBrands`, method: "POST" },
        { url: `${this.baseUrl}/brand/getBrandList`, method: "GET" },
        { url: `${this.baseUrl}/brand/getBrandList`, method: "POST" },
        { url: `${this.baseUrl}/brand/get`, method: "GET" },
        { url: `${this.baseUrl}/brand/getAll`, method: "GET" },
      ];

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep.url, {
            method: ep.method,
            headers,
            ...(ep.method === "POST" ? { body: JSON.stringify({}) } : {}),
            cache: "no-store",
          });

          if (!res.ok) continue;

          const data = await res.json();
          const list =
            data?.data?.brands ||
            data?.data ||
            data?.result?.brands ||
            data?.result ||
            (Array.isArray(data) ? data : null);

          if (Array.isArray(list) && list.length > 0) {
            return list
              .map((b: any) => ({
                id: String(b.id || b.brandId || b.code || "").trim(),
                name: String(b.name || b.brandName || b.title || "").trim(),
              }))
              .filter((b) => b.id && b.name);
          }
        } catch (e) {
          // try next endpoint
        }
      }

      return [];
    } catch (error) {
      console.error("Pazarama getBrands error:", error);
      return [];
    }
  }

  /**
   * Fetch category attributes (required for product upload)
   * Endpoint: /category/getCategoryWithAttributes?categoryId={id}
   */
  async getCategoryAttributes(categoryId: string): Promise<Array<{
    attributeId: string;
    attributeName: string;
    isRequired: boolean;
    values: Array<{ attributeValueId: string; value: string }>;
  }>> {
    try {
      const headers = await this.getHeaders();
      const url = `${this.baseUrl}/category/getCategoryWithAttributes?Id=${encodeURIComponent(categoryId)}`;

      console.log(`[Pazarama] GET ${url}`);

      const res = await fetch(url, {
        method: "GET",
        headers,
        cache: "no-store",
      });

      const rawText = await res.text().catch(() => "");
      console.log(`[Pazarama] Attribute HTTP ${res.status}:`, rawText.substring(0, 500));

      if (!res.ok) return [];

      const data = JSON.parse(rawText);
      const attrs = data?.data?.attributes || [];

      if (!Array.isArray(attrs) || attrs.length === 0) {
        console.log(`[Pazarama] Kategori ${categoryId} için attribute bulunamadı`);
        return [];
      }

      console.log(`[Pazarama] Kategori ${categoryId} için ${attrs.length} attribute bulundu`);
      return attrs.map((a: any) => ({
        attributeId: a.id || a.attributeId,
        attributeName: a.name || a.displayName || a.attributeName,
        isRequired: a.isRequired ?? false,
        values: (a.attributeValues || a.values || []).map((v: any) => ({
          attributeValueId: v.id || v.attributeValueId,
          value: v.value || v.name,
        })),
      }));
    } catch (error) {
      console.error("Pazarama getCategoryAttributes error:", error);
      return [];
    }
  }

  /**
   * Create / Upload product batch
   * Pazarama ürün ekleme endpoint: /product/create
   * Payload: { products: [...] } – Karışık casing (PascalCase + camelCase)
   */
  async createProductBatch(
    products: PazaramaProductInput[]
  ): Promise<PazaramaBatchResult> {
    try {
      const headers = await this.getHeaders();

      const productList = products.map((p) => {
        const rawImages = p.images || [];
        const imageObjects = rawImages.map((url) => ({
          imageurl: url,
        }));
        const groupCode = (p.code || "").substring(0, 10);
        const stockCode = p.code || "";
        return {
          Name: p.title,
          DisplayName: p.title,
          Description: p.description || p.title,
          brandId: p.brandId,
          CategoryId: p.categoryId,
          Code: p.barcode || p.code,
          groupCode: groupCode,
          stockCode: stockCode,
          StockCount: p.stockQuantity,
          VatRate: p.vatRate || 20,
          ListPrice: Math.max(p.listPrice, p.salePrice),
          SalePrice: p.salePrice,
          currencyType: "TRY",
          Desi: 1,
          images: imageObjects,
          attributes: p.attributes || [],
          deliveries: [],
        };
      });

      const payload = { products: productList };

      const endpoints = [
        `${this.baseUrl}/product/create`,
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`[Pazarama] POST ${endpoint} - ${productList.length} ürün gönderiliyor`);
          console.log(`[Pazarama] İlk ürün örneği:`, JSON.stringify(productList[0], null, 2));

          const res = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            cache: "no-store",
          });

          const rawText = await res.text().catch(() => "");
          console.log(`[Pazarama] HTTP ${res.status} yanıtı (${endpoint}):`, rawText.substring(0, 800));

          if (res.status === 404) continue;

          let data: any = {};
          try { data = JSON.parse(rawText); } catch { /* raw text yeterli */ }

          if (!res.ok) {
            const errMsg = data?.message || data?.Message || rawText.substring(0, 300) || `HTTP ${res.status}`;
            return { success: false, error: `Pazarama Hata (HTTP ${res.status}): ${errMsg}` };
          }

          if (data?.isSuccess === false || data?.success === false) {
            const errMsg = data?.message || data?.Message || data?.error
              || (Array.isArray(data?.errors) ? data.errors.join(", ") : "")
              || "Pazarama işlemi reddetti.";
            return { success: false, error: `Pazarama Hata: ${errMsg}` };
          }

          const rawBatchId =
            data?.batchRequestId ??
            data?.data?.batchRequestId ??
            data?.result?.batchRequestId ??
            data?.data?.id ??
            data?.id;

          const NULL_BATCH = "00000000-0000-0000-0000-000000000000";
          const validBatchId = rawBatchId && rawBatchId !== NULL_BATCH ? String(rawBatchId) : undefined;

          const isSuccess =
            data?.isSuccess === true ||
            data?.success === true ||
            Boolean(validBatchId) ||
            (typeof data?.message === "string" && data.message.includes("iletildi"));

          if (isSuccess) {
            return {
              success: true,
              batchId: validBatchId,
              message: validBatchId
                ? `Ürünler Pazarama'ya gönderildi. Paket ID: ${validBatchId}`
                : `Ürün Pazarama'ya iletildi. Onay sürecine girdi. Yanıt: ${rawText.substring(0, 200)}`,
            };
          }

          return {
            success: false,
            error: `Pazarama beklenmedik yanıt: ${rawText.substring(0, 400)}`,
          };
        } catch (e: any) {
          console.log(`[Pazarama] Endpoint hatası (${endpoint}):`, e.message);
          continue;
        }
      }

      return { success: false, error: "Pazarama: Hiçbir ürün oluşturma endpoint'i yanıt vermedi (tümü 404)." };
    } catch (error: any) {
      return {
        success: false,
        error: `İstek hatası: ${error.message || "Bağlantı kurulamadı"}`,
      };
    }
  }

  /**
   * Pazarama Dokümantasyonu Resmi Fiyat Güncelleme API Servisi
   * Endpoint: POST /product/updatePrice-v2
   * Doküman Linki: https://isortagim.pazarama.com/auth/integration/urun-fiyat-guncelleme
   */
  async updatePrice(
    items: Array<{ code: string; salePrice: number; listPrice?: number }>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await this.getHeaders();
      const payload = {
        items: items.map((i) => ({
          code: i.code,
          listPrice: i.listPrice || i.salePrice,
          salePrice: i.salePrice,
        })),
      };

      const endpoint = `${this.baseUrl}/product/updatePrice-v2`;
      console.log(`[Pazarama] POST ${endpoint} - ${items.length} ürün fiyatı güncelleniyor (updatePrice-v2)`);

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      const rawText = await res.text().catch(() => "");
      console.log(`[Pazarama] Fiyat Güncelleme HTTP ${res.status} (${endpoint}):`, rawText.substring(0, 400));

      if (res.status === 429) {
        return { success: false, message: "Pazarama API İstek Limiti Aşıldı (HTTP 429). Lütfen kısa bir süre sonra tekrar deneyiniz." };
      }

      let data: any = {};
      try { data = JSON.parse(rawText); } catch { /* ok */ }

      if (!res.ok) {
        const errMsg = data?.message || data?.Message || data?.error || rawText.substring(0, 200) || `HTTP ${res.status}`;
        return { success: false, message: `Pazarama Hata: ${errMsg}` };
      }

      if (data?.isSuccess === false || data?.success === false) {
        const errMsg = data?.message || data?.Message || data?.userMessage || "Fiyat güncelleme reddedildi.";
        return { success: false, message: `Pazarama Hata: ${errMsg}` };
      }

      return {
        success: true,
        message: `${items.length} adet ürünün fiyatı Pazarama'da (updatePrice-v2) sıraya alındı.`,
      };
    } catch (error: any) {
      return { success: false, message: `Fiyat güncelleme hatası: ${error.message}` };
    }
  }

  /**
   * Pazarama Dokümantasyonu Resmi Stok Güncelleme API Servisi
   * Endpoint: POST /product/updateStock-v2
   * Doküman Linki: https://isortagim.pazarama.com/auth/integration/urun-stok-guncelleme
   */
  async updateStock(
    items: Array<{ code: string; stock: number }>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await this.getHeaders();
      const payload = {
        items: items.map((i) => ({
          code: i.code,
          stockCount: i.stock,
        })),
      };

      const endpoint = `${this.baseUrl}/product/updateStock-v2`;
      console.log(`[Pazarama] POST ${endpoint} - ${items.length} ürün stoku güncelleniyor (updateStock-v2)`);

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      const rawText = await res.text().catch(() => "");
      console.log(`[Pazarama] Stok Güncelleme HTTP ${res.status} (${endpoint}):`, rawText.substring(0, 400));

      if (res.status === 429) {
        return { success: false, message: "Pazarama API İstek Limiti Aşıldı (HTTP 429). Lütfen kısa bir süre sonra tekrar deneyiniz." };
      }

      let data: any = {};
      try { data = JSON.parse(rawText); } catch { /* ok */ }

      if (!res.ok) {
        const errMsg = data?.message || data?.Message || data?.error || rawText.substring(0, 200) || `HTTP ${res.status}`;
        return { success: false, message: `Pazarama Hata: ${errMsg}` };
      }

      if (data?.isSuccess === false || data?.success === false) {
        const errMsg = data?.message || data?.Message || data?.userMessage || "Stok güncelleme reddedildi.";
        return { success: false, message: `Pazarama Hata: ${errMsg}` };
      }

      return {
        success: true,
        message: `${items.length} adet ürünün stoku Pazarama'da (updateStock-v2) sıraya alındı.`,
      };
    } catch (error: any) {
      return { success: false, message: `Stok güncelleme hatası: ${error.message}` };
    }
  }

  /**
   * Update Stock & Price for Pazarama products
   * Endpoints: /product/updatePrice-v2 & /product/updateStock
   */
  async updateStockAndPrice(
    items: Array<{ code: string; stock: number; price: number; listPrice?: number }>
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Fiyat Güncelle (updatePrice-v2)
      const priceRes = await this.updatePrice(
        items.map((i) => ({ code: i.code, salePrice: i.price, listPrice: i.listPrice }))
      );

      // 2. Stok Güncelle (updateStock)
      const stockRes = await this.updateStock(
        items.map((i) => ({ code: i.code, stock: i.stock }))
      );

      if (priceRes.success || stockRes.success) {
        return {
          success: true,
          message: `${items.length} adet ürünün stok ve fiyatı Pazarama'da sıraya alındı.`,
        };
      }

      return priceRes.success ? priceRes : stockRes;
    } catch (error: any) {
      return {
        success: false,
        message: `Güncelleme hatası: ${error.message}`,
      };
    }
  }

  /**
   * Fetch Pazarama Orders
   * Endpoint: POST /order/getOrdersForApi
   */
  async getOrders(params?: {
    pageSize?: number;
    pageNumber?: number;
    startDate?: string;
    endDate?: string;
    orderNumber?: number;
  }): Promise<PazaramaOrder[]> {
    try {
      const headers = await this.getHeaders();
      const endpoint = `${this.baseUrl}/order/getOrdersForApi`;

      const candidateBodies: any[] = [];

      if (params?.orderNumber) {
        candidateBodies.push({ orderNumber: Number(params.orderNumber) });
        candidateBodies.push({ orderNumber: String(params.orderNumber) });
      }

      if (params?.startDate || params?.endDate) {
        candidateBodies.push({
          startDate: params.startDate,
          endDate: params.endDate,
          pageSize: params?.pageSize || 100,
          pageNumber: params?.pageNumber || 1,
        });
      } else {
        const today = new Date();
        const past25Days = new Date(today.getTime() - 25 * 24 * 60 * 60 * 1000);
        const startDateStr = past25Days.toISOString().split("T")[0];
        const endDateStr = today.toISOString().split("T")[0];

        // 1. ISO format with T (Max 25 days range) - Pazarama required format
        candidateBodies.push({
          startDate: `${startDateStr}T00:00:00`,
          endDate: `${endDateStr}T23:59:59`,
          pageSize: 100,
          pageNumber: 1,
        });

        // 2. Simple YYYY-MM-DD (Max 25 days range)
        candidateBodies.push({
          startDate: startDateStr,
          endDate: endDateStr,
          pageSize: 100,
          pageNumber: 1,
        });
      }

      for (const body of candidateBodies) {
        try {
          console.log(`[Pazarama] POST ${endpoint} - body:`, JSON.stringify(body));

          const res = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            cache: "no-store",
          });

          const rawText = await res.text().catch(() => "");
          console.log(`[Pazarama] Order HTTP ${res.status}:`, rawText.substring(0, 800));

          if (!res.ok) continue;

          let data: any = {};
          try { data = JSON.parse(rawText); } catch {}

          if (data?.success === false) {
            console.error(`[Pazarama] Order query message:`, data?.message || data?.userMessage);
            continue;
          }

          let rawOrders = data?.data || data?.orders || data?.items || [];
          if (!Array.isArray(rawOrders) && typeof rawOrders === "object" && rawOrders !== null) {
            rawOrders = rawOrders.orders || rawOrders.items || rawOrders.content || rawOrders.list || [];
          }

          const orders = Array.isArray(rawOrders) ? rawOrders : [];

          if (orders.length > 0) {
            return orders.map((o: any) => ({
              id: String(o.orderId || o.id || o.orderNumber),
              orderNumber: String(o.orderNumber || o.orderId || o.id),
              orderDate: o.orderDate || o.createdDate || "",
              status: String(o.orderStatus != null ? o.orderStatus : o.status || ""),
              totalAmount: Number(o.orderAmount || o.totalAmount || 0),
              customerName: o.customerName || o.shipmentAddress?.nameSurname || (o.shipmentAddress ? `${o.shipmentAddress.firstName || ""} ${o.shipmentAddress.lastName || ""}`.trim() : "") || "",
              customerPhone: o.shipmentAddress?.phoneNumber || o.customerPhone || "",
              customerEmail: o.customerEmail || o.shipmentAddress?.customerEmail || "",
              deliveryAddress: {
                address: o.shipmentAddress?.addressDetail || o.shipmentAddress?.displayAddressText || o.shipmentAddress?.address || "",
                city: o.shipmentAddress?.cityName || o.shipmentAddress?.city || "",
                district: o.shipmentAddress?.districtName || o.shipmentAddress?.district || "",
                postalCode: o.shipmentAddress?.postalCode || "",
              },
              items: (o.items || o.orderItems || []).map((item: any) => {
                const pObj = item.product || {};
                const rawSku = pObj.stockCode || pObj.code || pObj.barcode || item.stockCode || item.code || item.sku || item.barcode || "";
                const rawBarcode = pObj.code || pObj.barcode || pObj.stockCode || item.code || item.barcode || item.sku || item.stockCode || "";
                return {
                  productId: String(item.orderItemId || item.productId || item.id || ""),
                  sku: String(rawSku).trim(),
                  barcode: String(rawBarcode).trim(),
                  productName: pObj.name || item.productName || item.title || "",
                  quantity: Number(item.quantity) || 1,
                  price: item.salePrice?.value != null ? Number(item.salePrice.value) : (Number(item.price) || 0),
                  totalAmount: item.totalPrice?.value != null ? Number(item.totalPrice.value) : (Number(item.totalAmount) || 0),
                };
              }),
            })) as PazaramaOrder[];
          }
        } catch (e: any) {
          console.error("[Pazarama] Candidate body request failed:", e);
        }
      }

      return [];
    } catch (error) {
      console.error("Pazarama getOrders error:", error);
      return [];
    }
  }

  /**
   * Get Batch Status
   * Real Pazarama endpoint: /productInput/getBatchRequestResult
   */
  async getBatchStatus(batchId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const headers = await this.getHeaders();

      // Gerçek Pazarama batch sonuç endpoint'i (productInput prefix)
      const candidateRequests = [
        { url: `${this.baseUrl}/productInput/getBatchRequestResult?batchRequestId=${encodeURIComponent(batchId)}`, method: "GET" },
        { url: `${this.baseUrl}/productInput/getBatchRequestResult`, method: "POST", body: { batchRequestId: batchId } },
        { url: `${this.baseUrl}/productInput/getBatchResult?batchRequestId=${encodeURIComponent(batchId)}`, method: "GET" },
        { url: `${this.baseUrl}/productInput/getBatchResult`, method: "POST", body: { batchRequestId: batchId } },
        // Eski fallback
        { url: `${this.baseUrl}/product/get-batch-result?batchRequestId=${encodeURIComponent(batchId)}`, method: "GET" },
        { url: `${this.baseUrl}/product/get-batch-result`, method: "POST", body: { batchRequestId: batchId } },
      ];

      let lastStatus = 0;
      let lastText = "";

      for (const req of candidateRequests) {
        try {
          const res = await fetch(req.url, {
            method: req.method,
            headers,
            ...(req.body ? { body: JSON.stringify(req.body) } : {}),
            cache: "no-store",
          });

          lastStatus = res.status;
          lastText = await res.text();

          if (res.ok) {
            try {
              const data = JSON.parse(lastText);
              return { success: true, data };
            } catch {
              return { success: true, data: lastText };
            }
          }
        } catch (e: any) {
          lastText = e.message;
        }
      }

      return {
        success: false,
        error: `Pazarama batch kontrol yanıtı (${lastStatus}): ${lastText ? lastText.substring(0, 200) : "Sunucu yanıt vermedi"}`,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Upload / Send Invoice Link to Pazarama
   * Official Doküman Endpoint: POST /order/invoice-link
   * Request Payload: { invoiceLink, orderid, deliveryCompanyId: null, trackingNumber: null }
   * 
   * orderid = Pazarama'nın UUID formatındaki kendi sipariş ID'si (shipmentPackageId olarak DB'de saklanır)
   */
  async uploadInvoiceLink(
    orderIdOrNumber: string | number,
    invoiceUrl: string,
    fallbackOrderNumber?: string | number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await this.getHeaders();
      const primaryId = String(orderIdOrNumber);
      
      // Build candidate IDs: primary first, then fallback if different
      const candidateIds = [primaryId];
      if (fallbackOrderNumber && String(fallbackOrderNumber) !== primaryId) {
        candidateIds.push(String(fallbackOrderNumber));
      }

      let lastErrorMessage = "";

      for (const orderId of candidateIds) {
        const candidateRequests = [
          // 1. Resmi Dokümantasyon Endpoint'i (küçük 'i' ile orderid)
          {
            url: `${this.baseUrl}/order/invoice-link`,
            body: {
              invoiceLink: invoiceUrl,
              orderid: orderId,
              deliveryCompanyId: null,
              trackingNumber: null,
            },
          },
          // 2. Büyük 'I' ile orderId denemeleri
          {
            url: `${this.baseUrl}/order/invoice-link`,
            body: {
              invoiceLink: invoiceUrl,
              orderId: orderId,
              deliveryCompanyId: null,
              trackingNumber: null,
            },
          },
        ];

        for (const req of candidateRequests) {
          try {
            console.log(`[Pazarama Invoice] POST ${req.url} - body:`, JSON.stringify(req.body));
            const res = await fetch(req.url, {
              method: "POST",
              headers,
              body: JSON.stringify(req.body),
              cache: "no-store",
            });

            const rawText = await res.text().catch(() => "");
            console.log(`[Pazarama Invoice] HTTP ${res.status} (${req.url}):`, rawText.substring(0, 500));

            if (res.status === 404) continue;

            let data: any = {};
            try { data = JSON.parse(rawText); } catch {}

            if (res.ok && data?.isSuccess !== false && data?.success !== false) {
              return {
                success: true,
                message: `Fatura linki Pazarama'ya başarıyla gönderildi. (orderId: ${orderId})`,
              };
            }

            // Capture the error message for reporting
            lastErrorMessage = data?.message || data?.userMessage || rawText.substring(0, 200) || `HTTP ${res.status}`;
          } catch (e: any) {
            console.error(`[Pazarama Invoice] Error calling ${req.url}:`, e.message);
            lastErrorMessage = e.message;
          }
        }
      }

      return { success: false, message: `Pazarama fatura gönderme isteği tamamlanamadı. Son hata: ${lastErrorMessage}` };
    } catch (error: any) {
      return { success: false, message: `Pazarama Fatura Hatası: ${error.message}` };
    }
  }
}

