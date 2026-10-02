export interface PazaramaConfig {
  apiKey: string;
  apiSecret: string;
  merchantId?: string;
  isActive: boolean;
  isTestMode: boolean;
  profitMargin?: number;
}

export interface PazaramaCategory {
  id: string;
  name: string;
  parentId?: string | null;
  subCategories?: PazaramaCategory[];
}

export interface PazaramaAttributeValue {
  id: string;
  value: string;
}

export interface PazaramaAttribute {
  id: string;
  name: string;
  isRequired: boolean;
  allowCustomValue: boolean;
  values?: PazaramaAttributeValue[];
}

export interface PazaramaCommercialTemplate {
  commercialId: string;
  isImported: boolean;
  type: number; // 0: Yerli İmalatçı, 1: İthalatçı, 2: Yetkili Temsilci, 3: İfa Hizmet Sağlayıcı
  name: string;
  title: string;
  brand?: string;
  email?: string;
  address?: string;
}

export interface PazaramaProductInput {
  code: string; // SKU / Stock Code
  title: string;
  description: string;
  barcode: string;
  brandId?: string;
  categoryId?: string;
  listPrice: number;
  salePrice: number;
  stockQuantity: number;
  vatRate: number;
  images: string[];
  attributes?: Array<{ attributeId: string; attributeValueId: string }>;
  commercialId?: string;
  securityDescription?: string;
}

export interface PazaramaBatchResult {
  success: boolean;
  batchId?: string;
  message?: string;
  error?: string;
}

export interface PazaramaOrder {
  id: string;
  orderNumber: string;
  orderDate: string;
  status: string;
  totalAmount: number;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress: {
    address: string;
    city: string;
    district: string;
    postalCode?: string;
  };
  items: Array<{
    productId: string;
    sku: string;
    barcode?: string;
    productName: string;
    quantity: number;
    price: number;
    totalAmount: number;
  }>;
}
