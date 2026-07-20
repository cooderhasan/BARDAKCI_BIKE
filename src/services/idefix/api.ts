
import { prisma } from "@/lib/db";

// ==================== TYPES ====================

export interface IdefixCreds {
  apiKey: string;
  apiSecret: string;
  vendorId: string;
  isTestMode?: boolean;
}

export interface IdefixCategory {
  id: number;
  name: string;
  parentId?: number;
  leaf?: boolean;
}

export interface IdefixBrand {
  id: number;
  name: string;
}

export interface IdefixProductPayload {
  barcode: string;
  title: string;
  brandId: number;
  categoryId: number;
  listPrice: number;
  salePrice: number;
  stockCode: string;
  quantity: number;
  description: string;
  images: { url: string }[];
  attributes?: { id: number; value: string }[];
  vatRate?: number;
  shipmentAddressId?: number;
  returningAddressId?: number;
  cargoCompanyId?: number;
}

export interface IdefixInventoryItem {
  barcode: string;
  price: number;
  comparePrice: number;
  inventoryQuantity: number;
  maximumPurchasableQuantity?: number;
  deliveryDuration?: number;
  deliveryType?: string;
  isZoneSale?: boolean | null;
}

export interface IdefixOrderParams {
  state?: string;
  startDate?: string;
  endDate?: string;
  lastUpdatedAt?: string;
  page?: number;
  limit?: number;
  sortByField?: string;
  sortDirection?: "asc" | "desc";
  orderNumber?: string;
  ids?: string;
}

// ==================== CLIENT ====================

export class IdefixClient {
  // Test (Stage) Ortami
  // PIM: https://ide-pimapi.idefiks.net/api
  // OMS: https://ide-omsapi.idefiks.net/api/shipment/connect/{vendorId}
  //
  // Canli (Production) Ortami
  // PIM: https://merchantapi.idefix.com/pim
  // OMS: https://merchantapi.idefix.com/oms/{vendorId}

  private pimBaseUrl: string;
  private omsBaseUrl: string;
  private creds: IdefixCreds | null = null;

  constructor(creds?: IdefixCreds) {
    if (creds) {
      this.creds = creds;
    }
    const isTest = creds?.isTestMode ?? true;
    this.pimBaseUrl = isTest
      ? "https://ide-pimapi.idefiks.net/api"
      : "https://merchantapi.idefix.com/pim";
    this.omsBaseUrl = isTest
      ? `https://ide-omsapi.idefiks.net/api/shipment/connect/${creds?.vendorId}`
      : `https://merchantapi.idefix.com/oms/${creds?.vendorId}`;
  }

  async init() {
    if (this.creds) return;
    const config = await (prisma as any).idefixConfig.findFirst({
      where: { isActive: true },
    });
    if (!config) throw new Error("Aktif Idefix yapilandirmasi bulunamadi.");

    this.creds = {
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      vendorId: config.vendorId,
      isTestMode: config.isTestMode,
    };

    const isTest = config.isTestMode;
    this.pimBaseUrl = isTest
      ? "https://ide-pimapi.idefiks.net/api"
      : "https://merchantapi.idefix.com/pim";
    this.omsBaseUrl = isTest
      ? `https://ide-omsapi.idefiks.net/api/shipment/connect/${config.vendorId}`
      : `https://merchantapi.idefix.com/oms/${config.vendorId}`;
  }

  private getVendorToken(): string {
    if (!this.creds) throw new Error("Idefix credentials eksik.");
    // VENDOR TOKEN = base64_encode(ApiKEY:ApiSecret)
    const pair = `${this.creds.apiKey}:${this.creds.apiSecret}`;
    return Buffer.from(pair).toString("base64");
  }

  private getHeaders(extraHeaders?: Record<string, string>) {
    return {
      "X-API-KEY": this.getVendorToken(),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...extraHeaders,
    };
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    body?: unknown
  ): Promise<T> {
    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      let errText = "";
      try {
        errText = await response.text();
      } catch {}
      throw new Error(
        `Idefix API Error [${response.status}] ${url}: ${errText}`
      );
    }

    const text = await response.text();
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  // ==================== URUN ENTEGRASYONU ====================

  /** Kategori listesini alir */
  async getCategories(): Promise<IdefixCategory[]> {
    const url = `${this.pimBaseUrl}/product-category`;
    return this.request<IdefixCategory[]>("GET", url);
  }

  /** Belirli kategori icin ozellik listesini alir */
  async getCategoryAttributes(categoryId: number): Promise<any[]> {
    const url = `${this.pimBaseUrl}/product-category/${categoryId}/attribute`;
    return this.request<any[]>("GET", url);
  }

  /** Marka listesini alir */
  async getBrands(page = 1, searchText?: string): Promise<{ items: IdefixBrand[]; totalCount: number }> {
    let url = `${this.pimBaseUrl}/brand?page=${page}&size=100`;
    if (searchText) url += `&name=${encodeURIComponent(searchText)}`;
    const res = await this.request<any>("GET", url);
    if (Array.isArray(res)) return { items: res, totalCount: res.length };
    return { items: res?.items ?? [], totalCount: res?.totalCount ?? 0 };
  }

  /** Isimle marka arar */
  async searchBrandByName(name: string): Promise<IdefixBrand | null> {
    try {
      const url = `${this.pimBaseUrl}/brand`;
      const result = await this.request<any>("GET", url);
      const items = Array.isArray(result) ? result : result?.items ?? [];
      return items.find((b: any) => b.title?.toLowerCase() === name.toLowerCase()) ?? null;
    } catch {
      return null;
    }
  }

  /** Saticiya ait urunleri listeler */
  async getMyProducts(page = 1, limit = 50): Promise<any> {
    const vendorId = this.creds?.vendorId;
    const url = `${this.pimBaseUrl}/catalog/${vendorId}/products?page=${page}&limit=${limit}`;
    return this.request<any>("GET", url);
  }

  /** Sevkiyat adresi listesi (shipmentAddressId icin) */
  async getShipmentAddresses(): Promise<any[]> {
    const url = `${this.pimBaseUrl}/shipment-address`;
    return this.request<any[]>("GET", url);
  }

  /** Kargo firma listesi */
  async getCargoCompanies(): Promise<any[]> {
    const url = `${this.pimBaseUrl}/cargo-companies`;
    return this.request<any[]>("GET", url);
  }

  /**
   * Hizli urun ekleme — Idefix kataloğunda barkod eslesmesi varsa kullanilir.
   * POST /pim/catalog/{vendorId}/fast-listing
   * Request body: { items: [ { barcode, title, vendorStockCode, price, comparePrice, inventoryQuantity } ] }
   */
  async quickAddProducts(items: Array<{
    barcode: string;
    title: string;
    vendorStockCode: string;
    price: number;
    comparePrice?: number;
    inventoryQuantity: number;
  }>): Promise<{ batchRequestId: string; status: string; items: any[] }> {
    const vendorId = this.creds?.vendorId;
    const url = `${this.pimBaseUrl}/catalog/${vendorId}/fast-listing`;
    return this.request<any>("POST", url, { items });
  }

  /**
   * Yeni urun olusturma — Idefix kataloğunda bulunmayan urunler icin.
   * POST /pim/pool/{vendorId}/create
   * Request body: { products: [ { barcode, title, productMainId, brandId, categoryId, ... } ] }
   */
  async createProducts(products: IdefixProductPayload[]): Promise<{ batchRequestId: string }> {
    const vendorId = this.creds?.vendorId;
    const url = `${this.pimBaseUrl}/pool/${vendorId}/create`;
    return this.request<{ batchRequestId: string }>("POST", url, { products });
  }

  /**
   * Toplu urun durumu sorgulama — batchRequestId ile gonderilen batch'in sonuclarini alir.
   * GET /pim/catalog/{vendorId}/batch-result/{batchId} (fast-listing icin)
   * GET /pim/pool/{vendorId}/batch-result/{batchId} (create icin)
   */
  async getBatchResult(batchRequestId: string, type: "fast-listing" | "create" = "fast-listing"): Promise<any> {
    const vendorId = this.creds?.vendorId;
    const pool = type === "create" ? "pool" : "catalog";
    const url = `${this.pimBaseUrl}/${pool}/${vendorId}/batch-result/${batchRequestId}`;
    return this.request<any>("GET", url);
  }

  /**
   * Urun eslesmesi onaylama — matchedProduct'i onaylar.
   */
  async approveMatch(payload: { barcode: string; productContentId: number }): Promise<any> {
    const url = `${this.pimBaseUrl}/connector/products/approve`;
    return this.request<any>("POST", url, payload);
  }

  /**
   * Urun eslesmesi reddetme.
   */
  async rejectMatch(payload: { barcode: string; productContentId: number }): Promise<any> {
    const url = `${this.pimBaseUrl}/connector/products/reject`;
    return this.request<any>("POST", url, payload);
  }

  /**
   * Stok ve fiyat guncelleme (inventory-upload).
   * POST /pim/catalog/{vendorId}/inventory
   */
  async updateInventory(items: IdefixInventoryItem[]): Promise<{ batchRequestId: string }> {
    const vendorId = this.creds?.vendorId;
    const url = `${this.pimBaseUrl}/catalog/${vendorId}/inventory-upload`;
    return this.request<{ batchRequestId: string }>("POST", url, { items });
  }

  /**
   * Stok/fiyat guncelleme durumu sorgulama.
   */
  async getInventoryStatus(batchRequestId: string): Promise<any> {
    const vendorId = this.creds?.vendorId;
    const url = `${this.pimBaseUrl}/catalog/${vendorId}/inventory/batch-result/${batchRequestId}`;
    return this.request<any>("GET", url);
  }

  // ==================== SIPARIS ENTEGRASYONU ====================

  /**
   * Siparis/sevkiyat listesi alir.
   * GET https://merchantapi.idefix.com/oms/{vendorId}/list
   */
  async getOrders(params: IdefixOrderParams = {}): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params.state) searchParams.set("state", params.state);
    if (params.startDate) searchParams.set("startDate", params.startDate);
    if (params.endDate) searchParams.set("endDate", params.endDate);
    if (params.lastUpdatedAt) searchParams.set("lastUpdatedAt", params.lastUpdatedAt);
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.sortByField) searchParams.set("sortByField", params.sortByField);
    if (params.sortDirection) searchParams.set("sortDirection", params.sortDirection);
    if (params.orderNumber) searchParams.set("orderNumber", params.orderNumber);
    if (params.ids) searchParams.set("ids", params.ids);

    const query = searchParams.toString();
    const url = `${this.omsBaseUrl}/list${query ? `?${query}` : ""}`;
    return this.request<any>("GET", url);
  }

  /**
   * Kargo kodu bildirme.
   * POST /oms/{vendorId}/{shipmentId}/update-tracking-number
   */
  async submitTrackingCode(
    shipmentId: string,
    payload: { trackingUrl: string; trackingNumber: string }
  ): Promise<any> {
    const url = `${this.omsBaseUrl}/${shipmentId}/update-tracking-number`;
    return this.request<any>("POST", url, payload);
  }

  /**
   * Shipment statu guncelleme.
   * POST /oms/{vendorId}/{shipmentId}/update-shipment-status
   * status: "picking" | "invoiced"
   */
  async updateShipmentStatus(shipmentId: string, status: string, invoiceNumber?: string): Promise<any> {
    const url = `${this.omsBaseUrl}/${shipmentId}/update-shipment-status`;
    const body: any = { status };
    if (invoiceNumber) body.invoiceNumber = invoiceNumber;
    return this.request<any>("POST", url, body);
  }

  /**
   * Fatura linki gonderme.
   */
  async sendInvoiceLink(shipmentId: string, invoiceLink: string): Promise<any> {
    const url = `${this.omsBaseUrl}/${shipmentId}/invoice`;
    return this.request<any>("POST", url, { invoiceLink });
  }

  /**
   * Teslim edildi bildirimi.
   */
  async markAsDelivered(shipmentId: string): Promise<any> {
    const url = `${this.omsBaseUrl}/${shipmentId}/delivered`;
    return this.request<any>("PUT", url, {});
  }

  /**
   * Iade listesi alir.
   */
  async getReturns(params: { page?: number; limit?: number } = {}): Promise<any> {
    const q = new URLSearchParams({
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 20),
    });
    const url = `${this.omsBaseUrl}/return/list?${q.toString()}`;
    return this.request<any>("GET", url);
  }

  /**
   * Baglantiyi test eder — kategori listesini ceker, basarili olursa baglanti dogru.
   */
  async checkConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const categories = await this.getCategories();
      const count = Array.isArray(categories) ? categories.length : 0;
      return {
        success: true,
        message: `Baglanti basarili! ${count} kategori bulundu.`,
      };
    } catch (err: any) {
      return { success: false, message: err.message || "Baglanti hatasi" };
    }
  }
}
