import { prisma } from "@/lib/db";
import {
  CiceksepetiConfig,
  CiceksepetiCategory,
  CiceksepetiAttribute,
  CiceksepetiProductInput,
  CiceksepetiPriceAndStockItem,
  CiceksepetiBatchResult,
  CiceksepetiOrder,
} from "./types";

export class CiceksepetiClient {
  private config: CiceksepetiConfig | null = null;
  private baseUrl: string;

  constructor(config?: CiceksepetiConfig) {
    if (config) {
      this.config = config;
      this.baseUrl = config.isTestMode
        ? "https://sandbox-apis.ciceksepeti.com/api/v1"
        : "https://apis.ciceksepeti.com/api/v1";
    } else {
      this.baseUrl = "https://apis.ciceksepeti.com/api/v1";
    }
  }

  /**
   * Database'den aktif Çiçeksepeti konfigürasyonunu yükler
   */
  async loadConfig(): Promise<CiceksepetiConfig> {
    if (this.config) return this.config;

    const dbConfig = await (prisma as any).ciceksepetiConfig.findFirst();

    if (!dbConfig || !dbConfig.apiKey) {
      throw new Error("Kaydedilmiş Çiçeksepeti API anahtarı bulunamadı. Lütfen önce ayarlarınızı kaydedin.");
    }

    this.config = {
      id: dbConfig.id,
      apiKey: dbConfig.apiKey,
      supplierId: dbConfig.supplierId,
      profitMargin: dbConfig.profitMargin,
      isActive: dbConfig.isActive,
      isTestMode: dbConfig.isTestMode,
    };

    this.baseUrl = dbConfig.isTestMode
      ? "https://sandbox-apis.ciceksepeti.com/api/v1"
      : "https://apis.ciceksepeti.com/api/v1";

    return this.config;
  }

  /**
   * Çiçeksepeti API istekleri için header hazırlar
   */
  private getHeaders(): Record<string, string> {
    if (!this.config || !this.config.apiKey) {
      throw new Error("Çiçeksepeti API Key bulunamadı.");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": this.config.apiKey.trim(),
    };

    if (this.config.supplierId && this.config.supplierId.trim()) {
      headers["User-Agent"] = this.config.supplierId.trim();
    } else {
      headers["User-Agent"] = "Motovitrin";
    }

    return headers;
  }

  /**
   * API Bağlantısını Test Eder
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.loadConfig();
      // Kategori listesini çekerek API Key doğruluyoruz
      const categories = await this.getCategories();
      if (Array.isArray(categories)) {
        return {
          success: true,
          message: `Çiçeksepeti API bağlantısı başarılı! (${this.config?.isTestMode ? "Test/Sandbox" : "Canlı"} Ortam)`,
        };
      }
      return {
        success: true,
        message: "Çiçeksepeti API bağlantısı sağlandı.",
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Bağlantı hatası: ${err?.message || "Geçersiz API Anahtarı veya sunucu yanıt vermiyor."}`,
      };
    }
  }

  /**
   * Tüm Çiçeksepeti Kategorilerini Getirir
   * GET /api/v1/Categories
   */
  async getCategories(): Promise<CiceksepetiCategory[]> {
    await this.loadConfig();
    const url = `${this.baseUrl}/Categories`;

    const res = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`Çiçeksepeti kategorileri alınamadı (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    // Yanıt doğrudan dizi veya { categories: [] } olabilir
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.categories)) return data.categories;
    if (data && Array.isArray(data.categoryList)) return data.categoryList;
    return [];
  }

  /**
   * Kategori Özelliklerini Getirir
   * GET /api/v1/Categories/{categoryId}/attributes
   */
  async getCategoryAttributes(categoryId: number | string): Promise<CiceksepetiAttribute[]> {
    await this.loadConfig();


    // 2) Resmi Dokümantasyon Uç Noktası: GET /api/v1/categories/{categoryId}/attributes
    const candidateUrls = [
      `${this.baseUrl}/categories/${categoryId}/attributes`,
      `${this.baseUrl}/Categories/${categoryId}/attributes`,
      `${this.baseUrl}/Categories/attributes?categoryId=${categoryId}`,
    ];

    const headers = this.getHeaders();
    let lastError = "";

    for (const url of candidateUrls) {
      try {
        console.log(`[CS-API] GET ${url}`);
        const res = await fetch(url, {
          method: "GET",
          headers,
          cache: "no-store",
        });

        const responseText = await res.text().catch(() => "");
        if (!res.ok) {
          console.warn(`[CS-API] ${url} returned ${res.status}:`, responseText);
          lastError = responseText || res.statusText;
          continue;
        }

        console.log(`[CS-API] ${url} SUCCESS:`, responseText.substring(0, 500));

        let data: any = {};
        try {
          data = JSON.parse(responseText);
        } catch {}

        let attrs: any[] = [];
        if (data && Array.isArray(data.categoryAttributes)) attrs = data.categoryAttributes;
        else if (Array.isArray(data)) attrs = data;
        else if (data && Array.isArray(data.attributes)) attrs = data.attributes;
        else if (data && Array.isArray(data.categoryAttributeList)) attrs = data.categoryAttributeList;
        else if (data && Array.isArray(data.attributeList)) attrs = data.attributeList;

        if (attrs && attrs.length > 0) {
          return attrs.map((a: any) => ({
            id: Number(a.attributeId || a.id),
            name: String(a.attributeName || a.name || "Nitelik"),
            required: Boolean(a.required || a.isRequired || a.mandatory),
            varianter: Boolean(a.varianter),
            type: String(a.type || ""),
            attributeValues: (a.attributeValues || a.values || a.options || []).map((v: any) => ({
              id: Number(v.id || v.valueId),
              name: String(v.name || v.valueName || String(v)),
            })),
          }));
        }
      } catch (err: any) {
        console.warn(`[CS-API] Error fetching ${url}:`, err.message);
      }
    }

    if (lastError) {
      console.error(`[CS-API] All category attribute endpoints failed for cat ${categoryId}: ${lastError}`);
    }

    // 3) Fallback: Eğer API nitelik dönmezse, Entegra ve Çiçeksepeti standardında Marka ve Renk alanlarını varsayılan sun
    return [
      {
        id: 1,
        name: "Marka",
        required: true,
        attributeValues: [],
      },
      {
        id: 2,
        name: "Renk",
        required: true,
        attributeValues: [],
      },
    ];
  }

  /**
   * Ürün Oluştur / Toplu Yükle
   * POST /api/v1/Products
   */
  async createOrUpdateProducts(products: CiceksepetiProductInput[]): Promise<CiceksepetiBatchResult> {
    await this.loadConfig();
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bardakcibike.com.tr";

    const formattedProducts = products.map((p) => {
      const formattedAttrs = (p.attributes || [])
        .map((attr: any) => {
          const attrId = Number(attr.attributeId || attr.Id || attr.id);
          const valId = (attr.attributeValueId !== undefined && attr.attributeValueId !== null && attr.attributeValueId !== "")
            ? Number(attr.attributeValueId || attr.ValueId || attr.valueId)
            : undefined;

          if (!attrId) return null;

          const item: any = {
            Id: attrId,
            id: attrId,
            attributeId: attrId,
            TextLength: Number(attr.textLength || attr.TextLength || 0),
            textLength: Number(attr.textLength || attr.TextLength || 0),
          };

          if (valId !== undefined && !isNaN(valId)) {
            item.ValueId = valId;
            item.valueId = valId;
            item.attributeValueId = valId;
          } else if (attr.customAttributeValue) {
            item.customAttributeValue = String(attr.customAttributeValue);
          }

          return item;
        })
        .filter((attr: any) => Boolean(attr));

      const rawDesc = p.description || p.productName || "";
      const cleanDesc = rawDesc.length >= 30 
        ? rawDesc 
        : `${rawDesc} - Orijinal ve kaliteli yedek parça & aksesuar. Bardakçı Bike & Motovitrin güvencesiyle hızlı kargo.`;

      const item: any = {
        productName: p.productName,
        mainProductCode: p.productCode || p.stockCode,
        stockCode: p.stockCode,
        categoryId: Number(p.subCategoryId || p.mainCategoryId) || 0,
        description: cleanDesc,
        supplierDescription: "",
        mediaLink: "",
        deliveryType: Number(p.deliveryType || 2), // 2: Kargo İle Gönderim
        deliveryMessageType: Number(p.deliveryMessageType || p.deliveryDays || 5), // 5: Hediye Kargo 1-3 İş Günü
        stockQuantity: Number(p.stockQuantity),
        salesPrice: Number(p.salesPrice),
        listPrice: Number(p.listPrice),
        barcode: p.barcode || p.stockCode,
        isActive: true,
        images: p.images.map((img) => {
          let rawUrl = typeof img === "string" ? img : (img as any)?.url || "";
          if (rawUrl && !rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
            if (!rawUrl.startsWith("/")) {
              rawUrl = `/${rawUrl}`;
            }
            rawUrl = `${siteUrl}${rawUrl}`;
          }
          return rawUrl;
        }),
        Attributes: formattedAttrs,
        attributes: formattedAttrs,
      };

      const rawContacts = (p.operatorContacts && Array.isArray(p.operatorContacts) && p.operatorContacts.length > 0)
        ? p.operatorContacts
        : [
            {
              type: 2,
              name: "BARDAKCI BİKE - HASAN BARDAKCI",
              address: "Sanayi Mah. 123 Sk. No:4 Düzce / Türkiye",
              email: "info@bardakcibike.com.tr"
            }
          ];

      const validContacts = rawContacts
        .map((oc: any) => {
          const nameStr = String(oc.name || "").trim() || "BARDAKCI BİKE - HASAN BARDAKCI";
          let addrStr = String(oc.address || "").trim() || "Sanayi Mah. 123 Sk. No:4 Düzce / Türkiye";
          if (addrStr.length < 3) addrStr = "Sanayi Mah. 123 Sk. No:4 Düzce / Türkiye";
          let emailStr = String(oc.email || "").trim() || "info@bardakcibike.com.tr";
          if (!emailStr.includes("@")) emailStr = "info@bardakcibike.com.tr";
          return {
            type: Number(oc.type || 2),
            name: nameStr,
            address: addrStr,
            email: emailStr,
          };
        })
        .filter((oc: any) => Boolean(oc.type && oc.name));

      if (validContacts.length > 0) {
        item.operatorContacts = validContacts;
      }

      if (p.safetyInfo) {
        item.safetyInfo = {
          warningDescription: String((p.safetyInfo as any).warningDescription || "Ustanıza danışınız.").trim(),
          ceSymbolValueId: Number((p.safetyInfo as any).ceSymbolValueId || 2),
          origin: String((p.safetyInfo as any).origin || "TR").trim(),
          ...((p.safetyInfo as any).frontImage ? { frontImage: String((p.safetyInfo as any).frontImage) } : {}),
          ...((p.safetyInfo as any).backImage ? { backImage: String((p.safetyInfo as any).backImage) } : {})
        };
      }

      return item;
    });

    const url = `${this.baseUrl}/Products`;
    const headers = this.getHeaders();
    const payload = { products: formattedProducts };

    console.log("[CS-API] POST /api/v1/Products Payload:", JSON.stringify(payload, null, 2));

    let res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    let responseText = await res.text().catch(() => "");

    // Eğer Çiçeksepeti 5 saniye limit aşımı hatası veya 502 verirse 6.5 saniye bekleyip 1 kez otomatik tekrar dene
    if (!res.ok && (res.status === 502 || res.status === 503 || res.status === 504 || responseText.includes("Limit aşımı") || responseText.includes("502 Bad Gateway"))) {
      console.log("[CS-API] Rate limit / 502 alındı. 6.5 saniye bekleniyor ve tekrar deneniyor...");
      await new Promise((resolve) => setTimeout(resolve, 6500));
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      responseText = await res.text().catch(() => "");
    }

    if (!res.ok) {
      console.error(`[CS-API] Error ${res.status}:`, responseText);
      let detailMsg = responseText;
      try {
        const errJson = JSON.parse(responseText);
        detailMsg = errJson.message || errJson.Message || errJson.error || (Array.isArray(errJson.errors) ? errJson.errors.map((e: any) => typeof e === "string" ? e : e.message || JSON.stringify(e)).join(", ") : "") || JSON.stringify(errJson);
      } catch {}
      throw new Error(`Çiçeksepeti ürün yükleme hatası (${res.status}): ${detailMsg || res.statusText || "Geçersiz İstek"}`);
    }

    try {
      const data = JSON.parse(responseText);
      return {
        batchId: data.batchId || data.batchRequestId || data.id || "SUCCESS",
        status: data.status || "PENDING",
        itemCount: products.length,
      };
    } catch {
      return {
        batchId: responseText || "SUCCESS",
        status: "PENDING",
        itemCount: products.length,
      };
    }
  }

  /**
   * Var Olan Ürün Bilgilerini Güncelle (Ad, Açıklama, Resim, Nitelik vb.)
   * PUT /api/v1/Products
   */
  async updateProducts(products: CiceksepetiProductInput[]): Promise<CiceksepetiBatchResult> {
    await this.loadConfig();
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bardakcibike.com.tr";

    const formattedProducts = products.map((p) => {
      const formattedAttrs = (p.attributes || [])
        .map((attr: any) => {
          const attrId = Number(attr.attributeId || attr.Id || attr.id);
          const valId = (attr.attributeValueId !== undefined && attr.attributeValueId !== null && attr.attributeValueId !== "")
            ? Number(attr.attributeValueId || attr.ValueId || attr.valueId)
            : undefined;

          if (!attrId) return null;

          const item: any = {
            Id: attrId,
            id: attrId,
            attributeId: attrId,
            TextLength: Number(attr.textLength || attr.TextLength || 0),
            textLength: Number(attr.textLength || attr.TextLength || 0),
          };

          if (valId !== undefined && !isNaN(valId)) {
            item.ValueId = valId;
            item.valueId = valId;
            item.attributeValueId = valId;
          } else if (attr.customAttributeValue) {
            item.customAttributeValue = String(attr.customAttributeValue);
          }

          return item;
        })
        .filter((attr: any) => Boolean(attr));

      const rawDesc = p.description || p.productName || "";
      const cleanDesc = rawDesc.length >= 30 
        ? rawDesc 
        : `${rawDesc} - Orijinal ve kaliteli yedek parça & aksesuar. Bardakçı Bike & Motovitrin güvencesiyle hızlı kargo.`;

      const item: any = {
        productName: p.productName,
        mainProductCode: p.productCode || p.stockCode,
        stockCode: p.stockCode,
        categoryId: Number(p.subCategoryId || p.mainCategoryId) || 0,
        description: cleanDesc,
        supplierDescription: "",
        mediaLink: "",
        deliveryType: Number(p.deliveryType || 2), // 2: Kargo İle Gönderim
        deliveryMessageType: Number(p.deliveryMessageType || p.deliveryDays || 5), // 5: Hediye Kargo 1-3 İş Günü
        stockQuantity: Number(p.stockQuantity),
        salesPrice: Number(p.salesPrice),
        listPrice: Number(p.listPrice),
        barcode: p.barcode || p.stockCode,
        isActive: true,
        images: p.images.map((img) => {
          let rawUrl = typeof img === "string" ? img : (img as any)?.url || "";
          if (rawUrl && !rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
            if (!rawUrl.startsWith("/")) {
              rawUrl = `/${rawUrl}`;
            }
            rawUrl = `${siteUrl}${rawUrl}`;
          }
          return rawUrl;
        }),
        Attributes: formattedAttrs,
        attributes: formattedAttrs,
      };

      const rawContacts = (p.operatorContacts && Array.isArray(p.operatorContacts) && p.operatorContacts.length > 0)
        ? p.operatorContacts
        : [
            {
              type: 2,
              name: "BARDAKCI BİKE - HASAN BARDAKCI",
              address: "Sanayi Mah. 123 Sk. No:4 Düzce / Türkiye",
              email: "info@bardakcibike.com.tr"
            }
          ];

      const validContacts = rawContacts
        .map((oc: any) => {
          const nameStr = String(oc.name || "").trim() || "BARDAKCI BİKE - HASAN BARDAKCI";
          let addrStr = String(oc.address || "").trim() || "Sanayi Mah. 123 Sk. No:4 Düzce / Türkiye";
          if (addrStr.length < 3) addrStr = "Sanayi Mah. 123 Sk. No:4 Düzce / Türkiye";
          let emailStr = String(oc.email || "").trim() || "info@bardakcibike.com.tr";
          if (!emailStr.includes("@")) emailStr = "info@bardakcibike.com.tr";
          return {
            type: Number(oc.type || 2),
            name: nameStr,
            address: addrStr,
            email: emailStr,
          };
        })
        .filter((oc: any) => Boolean(oc.type && oc.name));

      if (validContacts.length > 0) {
        item.operatorContacts = validContacts;
      }

      if (p.safetyInfo) {
        item.safetyInfo = {
          warningDescription: String((p.safetyInfo as any).warningDescription || "Ustanıza danışınız.").trim(),
          ceSymbolValueId: Number((p.safetyInfo as any).ceSymbolValueId || 2),
          origin: String((p.safetyInfo as any).origin || "TR").trim(),
          ...((p.safetyInfo as any).frontImage ? { frontImage: String((p.safetyInfo as any).frontImage) } : {}),
          ...((p.safetyInfo as any).backImage ? { backImage: String((p.safetyInfo as any).backImage) } : {})
        };
      }

      return item;
    });

    const url = `${this.baseUrl}/Products`;
    const headers = this.getHeaders();
    const payload = { products: formattedProducts };

    console.log("[CS-API] PUT /api/v1/Products Payload:", JSON.stringify(payload, null, 2));

    let res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    let responseText = await res.text().catch(() => "");

    // Eğer Çiçeksepeti 5 saniye limit aşımı hatası veya 502 verirse 6.5 saniye bekleyip 1 kez otomatik tekrar dene
    if (!res.ok && (res.status === 502 || res.status === 503 || res.status === 504 || responseText.includes("Limit aşımı") || responseText.includes("502 Bad Gateway"))) {
      console.log("[CS-API] PUT update rate limit / 502 alındı. 6.5 saniye bekleniyor ve tekrar deneniyor...");
      await new Promise((resolve) => setTimeout(resolve, 6500));
      res = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      responseText = await res.text().catch(() => "");
    }

    if (!res.ok) {
      console.error(`[CS-API] Error ${res.status}:`, responseText);
      let detailMsg = responseText;
      if (responseText.includes("<html>") || responseText.includes("502 Bad Gateway")) {
        detailMsg = "Çiçeksepeti sunucuları geçici olarak yanıt vermiyor (Cloudflare 502 Bad Gateway). Lütfen birkaç saniye sonra tekrar deneyin.";
      } else {
        try {
          const errJson = JSON.parse(responseText);
          detailMsg = errJson.message || errJson.Message || errJson.error || (Array.isArray(errJson.errors) ? errJson.errors.map((e: any) => typeof e === "string" ? e : e.message || JSON.stringify(e)).join(", ") : "") || JSON.stringify(errJson);
        } catch {}
      }
      throw new Error(`Çiçeksepeti ürün güncelleme hatası (${res.status}): ${detailMsg || res.statusText || "Geçersiz İstek"}`);
    }

    try {
      const data = JSON.parse(responseText);
      return {
        batchId: data.batchId || data.batchRequestId || data.id || "SUCCESS",
        status: data.status || "PENDING",
        itemCount: products.length,
      };
    } catch {
      return {
        batchId: responseText || "SUCCESS",
        status: "PENDING",
        itemCount: products.length,
      };
    }
  }

  /**
   * Stok ve Fiyat Güncelleme
   * PUT /api/v1/Products/price-and-stock
   */
  async updatePricesAndStocks(items: CiceksepetiPriceAndStockItem[]): Promise<CiceksepetiBatchResult> {
    await this.loadConfig();
    const url = `${this.baseUrl}/Products/price-and-stock`;

    const payload = {
      items: items.map((item) => ({
        stockCode: item.stockCode,
        productCode: item.productCode || item.stockCode,
        salesPrice: item.salesPrice,
        listPrice: item.listPrice ?? item.salesPrice,
        stockQuantity: item.stockQuantity,
      })),
    };

    let res = await fetch(url, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    let responseText = await res.text().catch(() => "");

    // 502 Bad Gateway veya 503/504/Rate Limit geçici sunucu hatasında 6.5 sn bekleyip tekrar dene
    if (!res.ok && (res.status === 502 || res.status === 503 || res.status === 504 || responseText.includes("502 Bad Gateway") || responseText.includes("Limit aşımı"))) {
      console.warn("[CS-API] 502/503/Rate-limit alındı. 6.5 saniye bekleniyor ve tekrar deneniyor...");
      await new Promise((resolve) => setTimeout(resolve, 6500));
      res = await fetch(url, {
        method: "PUT",
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      responseText = await res.text().catch(() => "");
    }

    if (!res.ok) {
      let cleanMessage = responseText;
      if (responseText.includes("<html>") || responseText.includes("502 Bad Gateway")) {
        cleanMessage = "Çiçeksepeti sunucuları geçici olarak yanıt vermiyor (Cloudflare 502 Bad Gateway). Lütfen birkaç saniye sonra tekrar deneyin.";
      }
      throw new Error(`Çiçeksepeti fiyat/stok güncelleme hatası (${res.status}): ${cleanMessage}`);
    }

    try {
      const data = JSON.parse(responseText);
      return {
        batchId: data.batchId || data.batchRequestId || data.id || "",
        status: data.status || "SUCCESS",
        itemCount: items.length,
      };
    } catch {
      return {
        batchId: responseText,
        status: "SUCCESS",
        itemCount: items.length,
      };
    }
  }

  /**
   * Batch İşlem Durumu Sorgula
   * GET /api/v1/Products/batch-status/{batchId}
   */
  async getBatchStatus(batchId: string): Promise<CiceksepetiBatchResult> {
    await this.loadConfig();
    const url = `${this.baseUrl}/Products/batch-status/${batchId}`;

    const res = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`Batch durumu alınamadı (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    return {
      batchId: data.batchId || batchId,
      status: data.status || "COMPLETED",
      errors: data.errors || data.messages || [],
      itemCount: data.itemCount || 0,
    };
  }

  /**
   * Siparişleri Çek
   * POST /api/v1/Order/GetOrders
   */
  async getOrders(params?: {
    startDate?: string;
    endDate?: string;
    pageSize?: number;
    page?: number;
    statusId?: number;
  }): Promise<CiceksepetiOrder[]> {
    await this.loadConfig();
    const url = `${this.baseUrl}/Order/GetOrders`;

    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const bodyPayload: any = {
      startDate: params?.startDate || fourteenDaysAgo.toISOString(),
      endDate: params?.endDate || now.toISOString(),
      pageSize: params?.pageSize || 100,
      page: params?.page ?? 0,
    };

    if (params?.statusId != null) {
      bodyPayload.statusId = params.statusId;
    }

    console.log(`🧾 [CS-ORDERS] Requesting ${url} with payload:`, JSON.stringify(bodyPayload));

    const res = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(bodyPayload),
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`Çiçeksepeti siparişleri çekilemedi (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    console.log("🧾 [CS-ORDERS] Raw response keys:", Object.keys(data || {}));

    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.supplierOrderListWithBranch)) return data.supplierOrderListWithBranch;
    if (data && Array.isArray(data.orders)) return data.orders;
    if (data && Array.isArray(data.supplierOrders)) return data.supplierOrders;
    if (data && Array.isArray(data.orderList)) return data.orderList;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }
}
