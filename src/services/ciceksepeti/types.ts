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

export interface CiceksepetiOperatorContact {
  type: number; // 1: İmalatçı, 2: İthalatçı, 3: Yetkili Temsilci, 4: İfa Hizmet Sağlayıcı
  name: string;
  address: string;
  email: string;
}

export interface CiceksepetiProductInput {
  productName: string;
  productCode?: string; // Satıcı stok kodu (SKU)
  stockCode: string;   // Varyant / Barkod
  mainCategoryId: number | string;
  subCategoryId?: number | string;
  description: string;
  deliveryType?: number; // 2 = Kargo ile teslimat
  deliveryMessageType?: number; // 5 = 1-3 iş günü teslimat
  deliveryDays?: number; // Eski uyumluluk için
  listPrice: number;
  salesPrice: number;
  stockQuantity: number;
  barcode: string;
  images: string[];
  attributes?: CiceksepetiProductAttributeInput[];
  operatorContacts?: CiceksepetiOperatorContact[];
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
