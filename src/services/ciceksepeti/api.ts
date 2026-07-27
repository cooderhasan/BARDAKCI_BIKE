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

    const dbConfig = await (prisma as any).ciceksepetiConfig.findFirst({
      where: { isActive: true },
    });

    if (!dbConfig) {
      throw new Error("Aktif Çiçeksepeti yapılandırması bulunamadı.");
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

    return {
      "Content-Type": "application/json",
      "x-api-key": this.config.apiKey.trim(),
    };
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
    const url = `${this.baseUrl}/Categories/${categoryId}/attributes`;

    const res = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.attributes)) return data.attributes;
    return [];
  }

  /**
   * Ürün Oluştur / Toplu Yükle
   * POST /api/v1/Products
   */
  async createOrUpdateProducts(products: CiceksepetiProductInput[]): Promise<CiceksepetiBatchResult> {
    await this.loadConfig();
    const url = `${this.baseUrl}/Products`;

    const payload = {
      products: products.map((p) => ({
        productName: p.productName,
        productCode: p.productCode || p.stockCode,
        stockCode: p.stockCode,
        categoryId: p.subCategoryId || p.mainCategoryId,
        description: p.description,
        deliveryType: p.deliveryType || 1,
        deliveryDays: p.deliveryDays || 2,
        listPrice: p.listPrice,
        salesPrice: p.salesPrice,
        stockQuantity: p.stockQuantity,
        barcode: p.barcode,
        images: p.images.map((img) => ({ url: img })),
        attributes: p.attributes || [],
      })),
    };

    const res = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const responseText = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(`Çiçeksepeti ürün yükleme hatası (${res.status}): ${responseText}`);
    }

    try {
      const data = JSON.parse(responseText);
      return {
        batchId: data.batchId || data.batchRequestId || data.id || "",
        status: data.status || "PENDING",
        itemCount: products.length,
      };
    } catch {
      return {
        batchId: responseText,
        status: "PENDING",
        itemCount: products.length,
      };
    }
  }

  /**
   * Stok ve Fiyat Güncelleme
   * POST /api/v1/Products/price-and-stock
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

    const res = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const responseText = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(`Çiçeksepeti fiyat/stok güncelleme hatası (${res.status}): ${responseText}`);
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

    const bodyPayload = {
      startDate: params?.startDate,
      endDate: params?.endDate,
      pageSize: params?.pageSize || 50,
      page: params?.page || 1,
      statusId: params?.statusId,
    };

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
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.orders)) return data.orders;
    if (data && Array.isArray(data.supplierOrders)) return data.supplierOrders;
    return [];
  }
}
