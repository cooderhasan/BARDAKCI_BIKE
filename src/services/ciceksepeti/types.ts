export interface CiceksepetiConfig {
  id?: string;
  apiKey: string;
  supplierId?: string | null;
  profitMargin?: number | null;
  isActive: boolean;
  isTestMode: boolean;
}

export interface CiceksepetiCategory {
  id: number | string;
  name: string;
  parentCategoryId?: number | string | null;
  subCategories?: CiceksepetiCategory[];
}

export interface CiceksepetiAttributeValue {
  id: number | string;
  name: string;
}

export interface CiceksepetiAttribute {
  id: number | string;
  name: string;
  required: boolean;
  attributeValues?: CiceksepetiAttributeValue[];
}

export interface CiceksepetiProductAttributeInput {
  attributeId: number | string;
  attributeValueId?: number | string;
  customAttributeValue?: string;
}

export interface CiceksepetiProductInput {
  productName: string;
  productCode?: string; // Satıcı stok kodu (SKU)
  stockCode: string;   // Varyant / Barkod
  mainCategoryId: number | string;
  subCategoryId?: number | string;
  description: string;
  deliveryType?: number; // 1 = Kargo, 2 = Özel Teslimat
  deliveryDays?: number;
  listPrice: number;
  salesPrice: number;
  stockQuantity: number;
  barcode: string;
  images: string[];
  attributes?: CiceksepetiProductAttributeInput[];
}

export interface CiceksepetiPriceAndStockItem {
  productCode?: string;
  stockCode: string; // SKU / Barkod
  salesPrice?: number;
  listPrice?: number;
  stockQuantity?: number;
}

export interface CiceksepetiBatchResult {
  batchId?: string;
  status?: string; // PENDING, SUCCESS, FAILED
  errors?: string[];
  itemCount?: number;
  creationDate?: string;
}

export interface CiceksepetiOrderItem {
  id?: string | number;
  productName: string;
  code: string;       // Ürün kodu / SKU
  barcode?: string;
  quantity: number;
  price: number;
  taxRate?: number;
  totalPrice?: number;
}

export interface CiceksepetiOrder {
  orderId: string | number;
  orderNumber: string;
  orderStatus: string;
  customerName?: string;
  customerEmail?: string;
  shippingAddress?: any;
  billingAddress?: any;
  totalPrice: number;
  orderDate: string;
  items: CiceksepetiOrderItem[];
}
