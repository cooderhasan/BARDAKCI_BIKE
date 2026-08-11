import { prisma } from "@/lib/db";
import crypto from "crypto";

// ==================== TYPES ====================

export interface PttavmCreds {
  apiKey: string;
  accessToken: string;
  profitMargin?: number;
  isTestMode?: boolean;
}

export interface PttavmProductUpsertItem {
  barcode: string;
  gtin?: string;
  ean?: string;
  sku?: string;
  stockCode?: string;
  merchantItemCode?: string;
  active: boolean;
  title: string;
  name?: string;
  description?: string;
  longDescription?: string;
  shortDescription?: string;
  productDescription?: string;
  details?: string;
  categoryId?: number;
  brandId?: number;
  brand?: string;
  brandName?: string;
  quantity: number;
  stock?: number;
  priceWithoutVAT: number;
  priceWithoutVat?: number;
  priceWithVAT: number;
  vatRate: number;
  discount?: number;
  desi?: number;
  images?: { url: string }[];
  variants?: any[];
  isCargoFromSupplier?: boolean;
}

export interface PttavmStockPriceItem {
  barcode: string;
  active: boolean;
  quantity: number;
  stock?: number;
  priceWithoutVAT: number;
  priceWithoutVat?: number;
  priceWithVAT: number;
  vatRate: number;
  discount?: number;
  variants?: any[];
  isCargoFromSupplier?: boolean;
}

export interface PttavmOrderSearchParams {
  startDate?: string;
  endDate?: string;
  isActiveOrders?: boolean;
  page?: number;
  pageSize?: number;
}

// ==================== CLIENT ====================

export class PttavmClient {
  private baseUrl: string = "https://integration-api.pttavm.com";
  private creds: PttavmCreds | null = null;

  constructor(creds?: PttavmCreds) {
    if (creds) {
      this.creds = creds;
    }
  }

  async init() {
    if (this.creds) return;
    const config = await (prisma as any).pttavmConfig.findFirst({
      where: { isActive: true },
    });
    if (!config) throw new Error("Aktif ePttAVM yapılandırması bulunamadı.");

    this.creds = {
      apiKey: config.apiKey,
      accessToken: config.accessToken,
      profitMargin: config.profitMargin || 0,
      isTestMode: config.isTestMode,
    };
  }

  private getHeaders(): Record<string, string> {
    if (!this.creds?.apiKey || !this.creds?.accessToken) {
      throw new Error("ePttAVM API Key veya Access Token eksik.");
    }
    return {
      "Api-Key": this.creds.apiKey.trim(),
      "Access-Token": this.creds.accessToken.trim(),
      "X-Correlation-Id": crypto.randomUUID(),
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "BardakciBike-Integration/1.0",
    };
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
      cache: "no-store",
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const rawText = await response.text().catch(() => "");

    if (!response.ok) {
      throw new Error(
        `ePttAVM API Error [${response.status}] ${url}: ${rawText.substring(0, 300)}`
      );
    }

    if (!rawText) return {} as T;
    try {
      return JSON.parse(rawText) as T;
    } catch {
      return rawText as unknown as T;
    }
  }

  // ==================== ENTEGRASYON TESTİ ====================

  /** Bağlantıyı test eder */
  async checkConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.init();
      // Ana kategorileri sorgulayarak bağlantıyı doğrula
      const result = await this.request<any>("GET", "/api/v1/categories/main");
      if (result && (result.success || result.main_category)) {
        return { success: true, message: "ePttAVM API bağlantısı başarılı! Kategoriler çekildi." };
      }
      return { success: true, message: "ePttAVM API bağlantısı başarılı!" };
    } catch (err: any) {
      return { success: false, message: `ePttAVM Bağlantı Hatası: ${err.message}` };
    }
  }

  // ==================== KATEGORİ VE MARKA ====================

  /** Ana kategorileri alır */
  async getCategories(): Promise<any> {
    return this.request<any>("GET", "/api/v1/categories/main").catch(() =>
      this.request<any>("GET", "/api/v1/categories/tree")
    );
  }

  // ==================== ÜRÜN EKLEME / GÜNCELLEME (UPSERT) ====================

  /**
   * Ürün Ekleme / Güncelleme (Upsert)
   * POST /api/v1/products/upsert
   */
  async upsertProducts(items: PttavmProductUpsertItem[]): Promise<{
    countOfProductsToBeProcessed?: number;
    trackingId?: string;
    success: boolean;
    message?: string;
  }> {
    return this.request<any>("POST", "/api/v1/products/upsert", { items });
  }

  /**
   * Hızlı Stok ve Fiyat Güncelleme
   * POST /api/v1/products/stock-prices
   */
  async updateStockAndPrice(items: PttavmStockPriceItem[]): Promise<{
    countOfProductsToBeProcessed?: number;
    trackingId?: string;
    success: boolean;
    message?: string;
  }> {
    return this.request<any>("POST", "/api/v1/products/stock-prices", { items });
  }

  /**
   * Ürün İşlem Durumu Sorgulama (Tracking Result)
   * GET /api/v1/products/tracking-result/{trackingId}
   */
  async getTrackingResult(trackingId: string): Promise<any> {
    return this.request<any>("GET", `/api/v1/products/tracking-result/${trackingId}`);
  }

  // ==================== SİPARİŞ ENTEGRASYONU ====================

  /**
   * Sipariş arama ve listeleme
   * GET /api/v1/orders/search
   */
  async getOrders(params: PttavmOrderSearchParams = {}): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params.startDate) searchParams.set("startDate", params.startDate);
    if (params.endDate) searchParams.set("endDate", params.endDate);
    if (params.isActiveOrders !== undefined)
      searchParams.set("isActiveOrders", String(params.isActiveOrders));
    if (params.page) searchParams.set("page", String(params.page));
    if (params.pageSize) searchParams.set("pageSize", String(params.pageSize ?? 50));

    const query = searchParams.toString();
    const path = `/api/v1/orders/search${query ? `?${query}` : ""}`;
    return this.request<any>("GET", path);
  }

  /**
   * Tekil Sipariş Detayı Alma
   * GET /api/v1/orders/{orderId}
   */
  async getOrderDetail(orderId: string): Promise<any> {
    return this.request<any>("GET", `/api/v1/orders/${orderId}`);
  }

  /**
   * Fatura Yükleme
   * POST /api/v1/orders/{orderId}/invoice
   */
  async sendInvoice(orderId: string, payload: { lineItemId: number[]; content?: string; url?: string }): Promise<any> {
    return this.request<any>("POST", `/api/v1/orders/${orderId}/invoice`, payload);
  }
}
