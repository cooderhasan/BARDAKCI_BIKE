import { UserRole, UserStatus, Prisma } from "@prisma/client";

export type Decimal = Prisma.Decimal;

// ==================== USER TYPES ====================

export interface SessionUser {
    id: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    companyName?: string | null;
    discountGroupId?: string | null;
    discountRate?: number;
}

export interface UserWithDiscount {
    id: string;
    email: string;
    companyName: string | null;
    taxNumber: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    district: string | null;
    role: UserRole;
    status: UserStatus;
    discountGroup: {
        id: string;
        name: string;
        discountRate: Decimal;
    } | null;
}

// ==================== PRODUCT TYPES ====================

export interface ProductWithCategory {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    listPrice: Decimal;
    vatRate: number;
    minQuantity: number;
    stock: number;
    images: string[];
    isFeatured: boolean;
    isNew: boolean;
    isBestSeller: boolean;
    isActive: boolean;
    weight: Decimal | null;
    width: Decimal | null;
    height: Decimal | null;
    length: Decimal | null;
    desi: Decimal | null;
    category: {
        id: string;
        name: string;
        slug: string;
    } | null;
}

export interface PriceCalculation {
    listPrice: number;
    discountRate: number;
    discountedPrice: number;
    vatRate: number;
    vatAmount: number;
    finalPrice: number;
}

// ==================== CART TYPES ====================

export interface CartItem {
    productId: string;
    name: string;
    slug: string;
    image: string;
    quantity: number;
    listPrice: number;
    salePrice?: number;
    discountRate: number;
    vatRate: number;
    minQuantity: number;
    stock: number;
    variantId?: string;
    variantInfo?: string;
    desi?: number | null;
}

export interface CartSummary {
    items: CartItem[];
    subtotal: number;
    discountAmount: number;
    vatAmount: number;
    total: number;
    totalDesi: number;
    itemCount: number;
}

// ==================== ORDER TYPES ====================

export interface OrderWithItems {
    id: string;
    orderNumber: string;
    subtotal: number;
    discountAmount: number;
    appliedDiscountRate: number;
    vatAmount: number;
    total: number;
    shippingCost: number | null;
    shippingDesi: number | null;
    status: string;
    shippingAddress: any;
    cargoCompany: string | null;
    cargoTrackingNumber: string | null;
    trackingUrl: string | null;
    cargoLabelUrl: string | null;
    source: string | null;
    ykCargoKey: string | null;
    ykJobId: number | null;
    ykDocId: string | null;
    ykStatus: string | null;
    ykStatusMessage: string | null;
    ykSyncedAt: Date | string | null;
    ykError: string | null;
    notes: string | null;
    guestEmail: string | null;
    invoiceId: string | null;
    invoiceNo: string | null;
    invoiceStatus: string | null;
    invoiceUrl: string | null;
    createdAt: Date | string;
    user: {
        id: string;
        email: string;
        companyName: string | null;
        phone: string | null;
    } | null;
    items: {
        id: string;
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        discountRate: number;
        vatRate: number;
        lineTotal: number;
        product: {
            id: string;
            sku: string | null;
            slug: string;
            images: string[];
        } | null;
    }[];
    payment: {
        id: string;
        method: string;
        status: string;
        amount: number;
        providerData?: any;
    } | null;
}

// ==================== ADMIN TYPES ====================

export interface DashboardStats {
    totalOrders: number;
    totalRevenue: number;
    pendingOrders: number;
    pendingDealers: number;
    totalProducts: number;
    totalDealers: number;
}

// ==================== SITE SETTINGS ====================

export interface SliderItem {
    id: string;
    title: string | null;
    subtitle: string | null;
    imageUrl: string;
    linkUrl: string | null;
    order: number;
    isActive: boolean;
}

export interface SiteSettingsData {
    sliders?: SliderItem[];
    companyInfo?: {
        name: string;
        address: string;
        phone: string;
        email: string;
        taxNumber: string;
    };
    bankAccounts?: {
        bankName: string;
        accountHolder: string;
        iban: string;
    }[];
}
