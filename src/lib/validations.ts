import { z } from "zod";

// ==================== AUTH VALIDATIONS ====================

export const loginSchema = z.object({
    email: z.string().email("Geçerli bir e-posta adresi giriniz"),
    password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
});

export const registerSchema = z.object({
    name: z.string().min(2, "Ad soyad en az 2 karakter olmalıdır"),
    email: z.string().email("Geçerli bir e-posta adresi giriniz"),
    password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
    confirmPassword: z.string(),
    companyName: z.string().optional(),
    taxNumber: z.string().optional(),
    phone: z.string().min(10, "Geçerli bir telefon numarası giriniz"),
    address: z.string().min(10, "Adres en az 10 karakter olmalıdır"),
    city: z.string().min(2, "Şehir seçiniz"),
    district: z.string().min(2, "İlçe en az 2 karakter olmalıdır"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
});

// ==================== PRODUCT VALIDATIONS ====================

export const productSchema = z.object({
    name: z.string().min(2, "Ürün adı en az 2 karakter olmalıdır"),
    slug: z.string().min(2, "Slug en az 2 karakter olmalıdır").regex(/^[a-z0-9-]+$/, "Slug sadece küçük harf, rakam ve tire içerebilir"),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    brandId: z.string().optional(),
    origin: z.string().optional(),
    description: z.string().optional(),
    marketplaceDescription: z.string().optional(),
    listPrice: z.number().min(0, "Fiyat 0'dan küçük olamaz"),
    salePrice: z.number().min(0, "Fiyat 0'dan küçük olamaz").nullable().optional(),
    trendyolPrice: z.number().min(0, "Fiyat 0'dan küçük olamaz").optional(),
    n11Price: z.number().min(0, "Fiyat 0'dan küçük olamaz").optional(),
    hepsiburadaPrice: z.number().min(0, "Fiyat 0'dan küçük olamaz").optional(),
    vatRate: z.number().min(0).refine((val) => val === 10 || val === 20, "KDV oranı %10 veya %20 olmalıdır"),
    minQuantity: z.coerce.number().int().positive("Minimum adet pozitif olmalıdır").default(1),
    stock: z.coerce.number().int().min(0, "Stok negatif olamaz").default(0),
    criticalStock: z.coerce.number().int().min(0, "Kritik stok negatif olamaz").default(10),
    categoryIds: z.array(z.string()).default([]),
    isFeatured: z.boolean().default(false),
    isNew: z.boolean().default(false),
    isBestSeller: z.boolean().default(false),
    isActive: z.boolean().default(true),
    isBundle: z.boolean().default(false),
    // Marketplace Visibility
    isTrendyolActive: z.boolean().default(false),
    isN11Active: z.boolean().default(false),
    isHepsiburadaActive: z.boolean().default(false),
    isGoogleActive: z.boolean().default(false),
    // Kargo & Desi
    weight: z.coerce.number().min(0, "Ağırlık negatif olamaz").nullable().optional(),
    width: z.coerce.number().min(0, "Genişlik negatif olamaz").nullable().optional(),
    height: z.coerce.number().min(0, "Yükseklik negatif olamaz").nullable().optional(),
    length: z.coerce.number().min(0, "Uzunluk negatif olamaz").nullable().optional(),
    desi: z.coerce.number().min(0, "Desi negatif olamaz").nullable().optional(),
    referenceUrl: z.string().nullable().optional(),
    n11CatalogId: z.string().nullable().optional(),
});

// ==================== PRODUCT VARIANT VALIDATIONS ====================

export const productVariantSchema = z.object({
    color: z.string().optional(),
    size: z.string().optional(),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    stock: z.coerce.number().int().min(0, "Stok negatif olamaz").default(0),
    priceAdjustment: z.coerce.number().default(0),
    isActive: z.boolean().default(true),
});

// ==================== CATEGORY VALIDATIONS ====================

export const categorySchema = z.object({
    name: z.string().min(2, "Kategori adı en az 2 karakter olmalıdır"),
    slug: z.string().min(2, "Slug en az 2 karakter olmalıdır").regex(/^[a-z0-9-]+$/, "Slug sadece küçük harf, rakam ve tire içerebilir"),
    order: z.coerce.number().int().default(0),
    isActive: z.boolean().default(true),
});

// ==================== ORDER VALIDATIONS ====================

export const orderSchema = z.object({
    notes: z.string().optional(),
    shippingAddress: z.object({
        name: z.string().min(2),
        address: z.string().min(10),
        city: z.string().min(2),
        district: z.string().min(2, "İlçe zorunludur"),
        postalCode: z.string().optional(),
        phone: z.string().min(10),
    }),
});

export const updateOrderStatusSchema = z.object({
    status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
});

// ==================== DISCOUNT GROUP VALIDATIONS ====================

export const discountGroupSchema = z.object({
    name: z.string().min(2, "Grup adı en az 2 karakter olmalıdır"),
    discountRate: z.coerce.number().min(0, "İskonto oranı negatif olamaz").max(100, "İskonto oranı 100'ü geçemez"),
    isActive: z.boolean().default(true),
});

// ==================== USER MANAGEMENT VALIDATIONS ====================

export const updateUserStatusSchema = z.object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]),
    discountGroupId: z.string().optional(),
});

export const updateUserRoleSchema = z.object({
    role: z.enum(["GUEST", "CUSTOMER", "DEALER", "OPERATOR", "ADMIN"]),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type DiscountGroupInput = z.infer<typeof discountGroupSchema>;
