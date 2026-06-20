# Product Requirement Document (PRD) - Bardakcı Bike E-Commerce Platform

## 1. Project Overview
**Bardakcı Bike** (https://www.bardakcibike.com.tr) is a modern B2B/B2C e-commerce platform specializing in bicycle spare parts, accessories, and gear. The application is built using Next.js, Prisma, PostgreSQL, and Tailwind CSS. It supports multiple customer tiers (Individual retail customers, Approved corporate dealers, and Guests) and features robust marketplace integrations (Trendyol, Hepsiburada, N11) with automated stock synchronization.

---

## 2. Target Audience & User Roles
1. **Guest Visitor (Non-registered):**
   - Can browse products, filter by categories and brands, search.
   - Can view standard retail prices.
   - Can add products to the cart and proceed with **Guest Checkout**.
2. **Individual Customer (Retail B2C):**
   - Registered users with instant approval.
   - Can manage their profile, address book, and track order history.
3. **Corporate Dealer (B2B):**
   - Registered users requiring admin approval.
   - Once approved, they see discounted B2B pricing (iskonto) and custom payment terms.
4. **Administrator (Admin):**
   - Accesses `/admin` to manage orders, products, categories, stock, and marketplace configs.
   - Can print orders, perform bulk updates, and trigger marketplace syncing.

---

## 3. Site Map & Core Routes
- **Homepage (`/`):** Hero sliders, categories grid, featured products, search bar.
- **Product Listing / Search (`/categories`, `/search`):** Filters by brand, category, price range, and sort options.
- **Product Details Page (`/products/[slug]`):** Image galleries, SKU/barcode info, stock status, variants (e.g., color, size), description, and "Add to Cart" button.
- **Cart Page (`/cart`):** Cart item lists, quantity selectors, price totals, coupon application, checkout CTA.
- **Checkout Page (`/checkout`):**
  - Address selection/entry.
  - Shipping method selection.
  - Payment options: Credit Card (PayTR iFrame), Bank Transfer (Havale/EFT), Cash on Delivery (COD - prepared but disabled by default).
- **Authentication (`/login`, `/register`):** Login form, register form with individual/corporate selection.
- **Customer Dashboard (`/dashboard`, `/profile`):** View past orders, address book, password changes.
- **Admin Dashboard (`/admin`):**
  - `/admin/orders`: List and filter orders (by date, status, printing status `isPrinted`). Bulk actions (print, update status).
  - `/admin/products`: Product lists, add/edit products, bulk price/stock updates.
  - `/admin/integrations`: Settings and status logs for Trendyol, Hepsiburada, and N11.

---

## 4. Key Interactive Flows (For Test Testing)

### Flow 1: E2E Guest Purchase Flow
1. Navigate to Homepage (`/`).
2. Search for a product (e.g., "lastik" or select from categories).
3. View the product detail page, select a variant if applicable, and click **Add to Cart**.
4. Go to `/cart`, verify the item and totals, click **Proceed to Checkout**.
5. Fill in the Guest shipping/billing address details (including Name, Address, City, TC No/Tax ID).
6. Select shipping option.
7. Choose payment method **Bank Transfer (Havale/EFT)** or simulated **PayTR Credit Card**.
8. Submit the order and redirect to the **Order Success** page showing the Order ID.

### Flow 2: Customer Registration & Login Flow
1. Navigate to `/register`.
2. Choose "Bireysel" (Individual) or "Kurumsal" (Corporate).
3. Fill in fields (Name, Email, Password, Company details if corporate) and submit.
4. If Individual, verify automatic login. If Corporate, verify message "Awaiting Admin Approval".
5. Navigate to `/login`, enter credentials, and confirm successful redirect to dashboard.

### Flow 3: Admin Order Management & Printing
1. Log in to the admin panel.
2. Go to `/admin/orders`.
3. Filter orders using the **Yazdırma Durumu** (Printed Status) filter:
   - "Yazdırılmayanlar" (Not printed)
   - "Yazdırılanlar" (Printed)
4. Select one or more orders.
5. Click **Mark as Printed** (Yazdırıldı Olarak İşaretle) or click the Print icon to open the print layout.
6. Verify the order's `isPrinted` status changes to `true` and a printer badge is displayed next to it.

### Flow 4: Stock Sync & Critical Stock Prevention
1. When a product's stock is updated in `/admin/products` or via order checkout, the system calculates the remaining stock.
2. If remaining stock falls below the **Critical Stock Limit** (`criticalStock`), the system triggers an automatic API call to Trendyol, Hepsiburada, and N11 to set the marketplace stock to `0` (Tükendi) to prevent overselling on third-party stores.

---

## 5. Non-Functional Requirements & Integrations
- **SEO Uyumlu (SEO Friendly):** Dynamic metadata headers, search engine friendly URL structures, and fast load times.
- **Integrations:**
  - **PayTR Sanal POS** for credit cards.
  - **Trendyol, Hepsiburada, N11 APIs** using BullMQ background workers for async catalog/stock updates.
  - **E-Fatura (E-Invoice)** connector for automated invoicing.
