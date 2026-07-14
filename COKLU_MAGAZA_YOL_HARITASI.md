# Çoklu Mağaza (Multi-Store) Geçiş Yol Haritası

Bu kılavuz, **tek bir veritabanı ve tek bir yönetim paneli** üzerinden iki ayrı alan adı (domain) ile çalışan **Bardakçı Bisiklet (bardakcibike.com.tr)** ve **Motovitrin (motovitrin.com)** e-ticaret sitelerinin kurulumu ve tüm tasarım öğelerinin (banner, menü, logo, iletişim vb.) admin panelinden dinamik olarak yönetilmesi için adım adım yol haritasını içerir.

---

## 📌 Faz 1: Veritabanı ve Model Altyapısı (Prisma)

Tüm tasarım ve ürün içeriklerinin admin panelinden yönetilebilmesi için veritabanında hangi verinin hangi mağazaya ait olduğunu belirtecek alanlar eklenmelidir.

### 1. `Store` Enumu ve Tanımlamalar
`prisma.schema` dosyasına mağaza türlerini temsil eden bir enum eklenir:
```prisma
enum StoreType {
  BIKE    // Sadece Bardakçı Bisiklet
  MOTOR   // Sadece Motovitrin
  BOTH    // Her iki sitede ortak
}
```

### 2. Tablolara `store` Alanının Eklenmesi
Admin panelinden dinamik yönetilmesi gereken modellere `store` alanı entegre edilir:
*   **Product (Ürünler):** `store StoreType @default(BIKE)`
*   **Category (Kategoriler):** `store StoreType @default(BIKE)` (Hangi kategorinin hangi sitenin menüsünde/filtresinde görüneceğini ayırır).
*   **Banner (Slayt ve Afişler):** `store StoreType @default(BIKE)` (Ana sayfa görselleri için).
*   **SiteSettings (Genel Ayarlar):** Logo, telefon, e-posta, sosyal medya linkleri, e-fatura bilgileri ve site renk kodları (CSS Theme) mağaza bazlı ayrıştırılır.
*   **Order (Siparişler):** `store StoreType @default(BIKE)` (Siparişin hangi siteden geldiği raporlama ve fatura serisi için kaydedilir).

---

## 🌐 Faz 2: İstek Yakalama ve Alan Adı (Domain) Tespiti

Kullanıcının tarayıcıdan hangi domain ile girdiğini yakalayan ve sunucu tarafında diğer fonksiyonlara bildiren bir yardımcı (helper) modül oluşturulur.

### 1. `src/lib/store-helper.ts` Modülü
```typescript
import { headers } from "next/headers";

export async function getStoreType(): Promise<'BIKE' | 'MOTOR'> {
    const headersList = await headers();
    const host = headersList.get("host") || "";
    
    // motovitrin.com veya motovitrin test alan adlarını kontrol et
    if (host.includes("motovitrin")) {
        return "MOTOR";
    }
    return "BIKE"; // Varsayılan olarak bisiklet sitesi
}
```

---

## 🎨 Faz 3: Admin Paneli (Yönetim Ekranı) Güncellemeleri

Admin panelinde iki sitenin bağımsız yönetilebilmesi için yapılacak görsel ve işlevsel düzenlemeler.

### 1. Ürün Yönetimi
*   **Ürün Ekleme/Düzenleme Formu:** Ürün detayına `Mağaza Seçimi` (Checkbox/Toggle) eklenir. `[ ] Bisiklet` / `[ ] Motosiklet`.
*   **Ürün Listesi:** Ürünlerin yanında hangi sitede listelendiğine dair renkli etiketler (Bisiklet / Motor) gösterilir. Listeyi mağazaya göre filtreleme seçeneği eklenir.

### 2. Kategori Yönetimi
*   Kategori eklenirken o kategorinin hangi sitenin menü ağacına ait olduğu (`BIKE` veya `MOTOR`) seçilir.

### 3. Slayt ve Banner Yönetimi
*   Admin panelinde yeni slayt/afiş yüklenirken görselin hangi sitede yayınlanacağı seçilir.
*   Böylece bisiklet ana sayfasındaki dev slider ile motor ana sayfasındaki kampanyalar admin panelinden bağımsızca yönetilir.

### 4. Mağaza Genel Ayarları (Ayarlar Sayfası)
*   **Site Ayarları:** Tek sayfa yerine iki ayrı sekme açılır: **[Bardakçı Bisiklet Ayarları]** ve **[Motovitrin Ayarları]**.
*   Her mağaza için ayrı:
    *   Logo (Açık/Koyu tema logoları)
    *   İletişim Bilgileri (Telefon, E-posta, Adres, Harita)
    *   Sosyal Medya Linkleri
    *   **Renk Kodları (CSS):** Örneğin, bisiklet sitesi için ana renk mavi (`#17457C`), motor sitesi için turuncu (`#FF5722`) seçilebilir. Bu renk kodları sunucudan Tailwind/CSS değişkenlerine dinamik basılır.

---

## 🖥️ Faz 4: Önyüz (Storefront) Tasarımlarının Ayrıştırılması

Kullanıcının gördüğü önyüzün dinamik olarak şekillenmesi.

### 1. Layout Yapısı (`src/app/(storefront)/layout.tsx`)
*   `getStoreType()` fonksiyonu çağrılır.
*   **Tema Enjeksiyonu:** Seçilen mağazanın renk kodları HTML belgesinin en üstüne CSS değişkeni (Variables) olarak basılır:
    ```html
    <html style="--primary-color: ${activeSettings.primaryColor}">
    ```
*   **Header & Footer:** Aktif mağazanın logosu, menü yapısı ve footer bilgileri veritabanından çekilerek gösterilir.

### 2. Ana Sayfa (`src/app/(storefront)/page.tsx`)
*   Ana sayfaya tıklandığında domain tespit edilir.
*   Sadece o mağazaya ait aktif slaytlar (`Banner` tablosundan) ve öne çıkarılan kategoriler listelenir.

### 3. Kategori ve Ürün Listeleme (`/category/[slug]` ve `/products`)
*   İlanlar listelenirken veritabanına sorgu atılır:
    ```typescript
    where: { store: activeStore }
    ```
*   Böylece bisiklet sitesinde motor parçası, motor sitesinde bisiklet kaskı kesinlikle listelenmez.

---

## 💳 Faz 5: Sipariş, Ödeme ve Entegrasyon Entegrasyonu

Pazaryeri ve ödeme geçitlerinin tek veritabanı üzerinden sağlıklı yürümesi.

### 1. Ödeme Altyapısı (PayTR / iyzico)
*   Her iki sitenin de ödemesi tek bir şirket hesabına (PayTR vb.) akacaksa tek entegrasyon yeterlidir.
*   Eğer iki site için ayrı sanal pos kullanılacaksa, ödeme API anahtarları da yine yukarıdaki `SiteSettings` tablosundan dinamik olarak çekilir.

### 2. Pazaryeri Entegrasyonları (Hepsiburada / Trendyol)
*   Entegrasyon cron/job süreçlerinde tek mağazaya tüm ürünler gönderilir.
*   Filtreleme, eşleştirilen kategori IDsine göre yapıldığı için Hepsiburada'ya veri gönderirken hiçbir değişiklik gerekmez. Sistem her ürünü doğru kategorisine yükler.
*   Siparişler çekildiğinde tüm ürünler tek veritabanında mevcut olduğu için siparişler hatasız bir şekilde admin paneline düşer.

---

## 🛠️ Faz 6: Test ve Canlıya Alma (Coolify & DNS)

### 1. DNS Ayarları
*   `bardakcibike.com.tr` ve `motovitrin.com` domainlerinin A kayıtları Coolify IP adresine yönlendirilir.

### 2. Coolify Ayarı
*   Coolify Domains kısmına iki adres de virgülle eklenir:
    `https://bardakcibike.com.tr, https://motovitrin.com`

### 3. Çevre Değişkeni (Env)
*   Coolify üzerinde `AUTH_TRUST_HOST=true` çevre değişkeni tanımlanarak NextAuth'un her iki alan adını da tanıması ve üye girişlerinin iki sitede de çalışması sağlanır.

---

## 🛍️ Faz 7: Google Merchant Center (RSS XML Feed) Entegrasyonu

İki farklı web sitesinin Google Shopping reklamları ve ürün listelemeleri için iki ayrı Google Merchant Center hesabı kullanılır. Tek bir `/api/feed/google` endpoint'i üzerinden, gelen isteğin alan adına (host) göre dinamik feed oluşturulur.

### 1. Dinamik XML Feed Mantığı (`src/app/api/feed/google/route.ts`)
Gelen isteğin `host` bilgisine göre ürünlerin linkleri ve hangi ürünlerin listeleneceği dinamik filtreye tabi tutulur:

```typescript
export async function GET(request: Request) {
  try {
    const host = request.headers.get("host") || "bardakcibike.com.tr";
    const isMotor = host.includes("motovitrin");
    
    // Dinamik base URL oluşturulur (Görsel ve ürün linkleri için)
    const baseUrl = `https://${host}`;

    // Ürünleri ilgili mağaza filtresine göre çek
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        isGoogleActive: true,
        // İlgili mağaza filtresi
        store: isMotor ? "MOTOR" : "BIKE"
      },
      include: {
        brand: true,
        category: true
      }
    });

    // Google Kategori Kök Varsayılanı Dinamikleşir
    const googleCategoryFallback = isMotor 
      ? "Taşıtlar ve Parçalar > Araç Parçaları ve Aksesuarları > Motosiklet Parçaları"
      : "Spor ve Fitness > Açık Hava Aktiviteleri > Bisiklet";
      
    // ... XML üretimi ve yanıt dönüşü
  }
}
```

### 2. Merchant Center Kurulum Adımları
*   **Bardakçı Bisiklet Merchant Center:** Veri kaynağı (Feed URL) olarak `https://bardakcibike.com.tr/api/feed/google` adresi girilir. Bu adresten sadece bisiklet ürünleri çekilir.
*   **Motovitrin Merchant Center:** Veri kaynağı olarak `https://motovitrin.com/api/feed/google` adresi girilir. Bu adresten sadece motosiklet parçaları çekilir.
*   Next.js, istek atan Merchant Center botunun hangi domain üzerinden geldiğini tespit ederek otomatik olarak doğru ürünleri ve doğru URL'leri içeren XML çıktısını hazırlar.

---

## 🔍 Faz 8: Arama Motoru Optimizasyonu (SEO) ve Analitik Ayarları

Google (Googlebot), web sitelerini yalnızca domain adlarına göre değerlendirir. `bardakcibike.com.tr` ve `motovitrin.com` iki farklı domain olduğu için Google bunları **tamamen bağımsız iki ayrı site** olarak algılar, tarar ve indeksler. Paylaşılan sunucu veya veritabanı SEO açısından hiçbir sorun teşkil etmez.

### 1. Dinamik Sitemap ve Robots Yapılandırması
Sitemap ve robots dosyaları, istek atan arama motorunun domainine göre dinamik olarak doğru URL'leri üretecek şekilde güncellenir:

*   **`src/app/sitemap.ts` Güncellemesi:**
    Statik `process.env.NEXT_PUBLIC_APP_URL` yerine, isteğin geldiği domain dinamik olarak yakalanır. Sitemap içinde sadece o domaine ait olan ürünler, kategoriler ve sayfalar listelenir:
    ```typescript
    // sitemap.ts
    export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
        const host = headers().get("host") || "bardakcibike.com.tr";
        const baseUrl = `https://${host}`;
        const isMotor = host.includes("motovitrin");

        // Veritabanından sadece o mağazaya ait ürünleri ve kategorileri çek
        const products = await prisma.product.findMany({
            where: { isActive: true, store: isMotor ? "MOTOR" : "BIKE" },
            select: { slug: true, updatedAt: true }
        });
        
        // ... sitemap array'ini bu baseUrl ile dön
    }
    ```

*   **`src/app/robots.ts` Güncellemesi:**
    Sitemap yönlendirmesi yine istek yapılan domaine göre dinamikleşir:
    ```typescript
    export default function robots(): MetadataRoute.Robots {
        const host = headers().get("host") || "bardakcibike.com.tr";
        return {
            rules: {
                userAgent: "*",
                allow: "/",
                disallow: ["/admin/", "/api/", "/cart", "/checkout"],
            },
            sitemap: `https://${host}/sitemap.xml`,
        };
    }
    ```

### 2. Google Search Console & Analytics (GA4) / Meta Pixel
*   **Ayrıştırma:** Her iki site için Google Search Console'da ayrı mülkler (Property) ve Google Analytics 4 (GA4) üzerinde ayrı ölçüm kimlikleri tanımlanır.
*   **Dinamik Kod Enjeksiyonu:** Analytics takip kodu (G-XXXXXXX) ve Meta Pixel kodu veritabanındaki `SiteSettings` tablosundan domain bazlı çekilerek ilgili sitenin `<head>` kısmına dinamik olarak yerleştirilir.
*   **Duplicate Content (Kopya İçerik) Riski:** İki sitedeki ürünler tamamen farklı olacağı için (birinde sadece bisiklet, diğerinde motor yedek parçaları) arama motorları kopya içerik cezası (Duplicate Content Penalty) uygulamaz.


