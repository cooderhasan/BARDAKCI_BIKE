# Trendyol V2 Resmi API Entegrasyon & Güncelleme Rehberi

Bu belge, e-ticaret altyapımızdaki Trendyol entegrasyonunun **resmi Trendyol V2 API standartlarına** geçirilmesi ve kullanıcı deneyimi (UX) geliştirmelerini diğer projelere eksiksiz aktarmak için hazırlanmıştır.

---

## 🚀 Yeni Bir Projede Antigravity'ye Ne Söylemelisiniz?

Aynı altyapıya sahip başka bir firmanın projesini açtığınızda sohbete doğrudan şunu yazmanız yeterlidir:

> **"Bu projedeki Trendyol entegrasyonunu resmi V2 API'ye geçir. `TRENDYOL_V2_GUNCELLEME_REHBERI.md` dosyasındaki standartlara göre; `v2/products`, `storeFrontCode: TR` header'ı, `IN_PROGRESS` kuyruk takibi, 1000'lik özellik çekimi, çoklu kategori önceliği ve `AttributeSearchableSelect` arama kutulu seçim bileşenini eksiksiz uygula."**

Bu cümleyi söylediğiniz anda Antigravity projenin tüm Trendyol dosyalarını bu standartlara göre otomatik olarak güncelleyecektir.

---

## 📋 Neler Değişti? (Teknik Özet)

### 1. Trendyol V2 Endpoint Değişiklikleri (`src/services/trendyol/api.ts`)
* **Header Zorunluluğu:** Tüm isteklerde `storeFrontCode: "TR"` başlığı zorunlu kılındı.
* **Bağlantı Testi:** `GET /integration/product/sellers/{sellerId}/products/approved?size=1` endpoint'ine taşındı.
* **Ürün Aktarımı (V2):** Eski V1 endpointi yerine `POST /integration/product/sellers/{sellerId}/v2/products` kullanıldı.
* **Onaylı Ürün İçerik Güncelleme:** `POST /integration/product/sellers/{sellerId}/products/content-bulk-update` eklendi.
* **Kategori Özellik Değerleri:** Trendyol V2'de özellik değerleri sayfalı döner (`GET .../categories/{catId}/attributes/{attrId}/values?size=1000`). `size=1000` eklenerek Tek Ebat, TR, CN, Siyah gibi 20'nin üzerindeki değerlerin kesilmesi engellendi.

### 2. Asenkron İşlem (Batch) Kuyruğu (`actions.ts` & `batches/page.tsx`)
* Trendyol V2 bulk işlemleri hemen tamamlamaz, `IN_PROGRESS` (Kuyrukta İşleniyor) olarak başlatır.
* `syncBatchStatuses()` sorgusuna `{ batchStatus: "IN_PROGRESS" }` eklendi. Böylece kuyruk bittiğinde ürünün onaylandığı veya ret gerekçesi sistem tarafından otomatik yakalanır.
* Ürün listesine tek tıkla erişilen **"İşlem Geçmişi (Batch İzle)"** butonu eklendi.

### 3. Akıllı Kategori & Çoklu Kategori Çözümü
* Bir üründe birden fazla kategori seçiliyse (örneğin hem *Bisiklet İç Lastik* hem *Yedek Parça*), sistem artık spesifik olanı (`#3680`) otomatik önceliklendirir.
* Modal pencerenin en üstüne çoklu kategori durumunda kullanıcının istediği Trendyol kategorisini seçebileceği açılır menü eklendi.
* `sendProductToTrendyol` fonksiyonuna `targetCategoryId` parametresi eklendi.

### 4. Arama Kutulu Seçim Bileşeni (`AttributeSearchableSelect.tsx`)
* 266 Beden ve 230 Menşei arasında kaybolmamak için anlık filtreleme yapan `AttributeSearchableSelect` combobox bileşeni yazıldı.
* Popüler değerler (Tek Ebat, TR, CN, Siyah, Beyaz) listenin en tepesine sabitlendi.
* Modal açıldığında zorunlu alanlar otomatik dolduruluyor.
* İsteğe bağlı 16 adet GPSR ithalatçı alanı katlanabilir akordiyon içine gizlendi.

---

## 📂 Değiştirilen ve Eklenen Dosyalar

1. `src/services/trendyol/api.ts` (V2 endpointleri, `storeFrontCode`, `size=1000`)
2. `src/app/admin/(protected)/integrations/trendyol/actions.ts` (V2 batch & kategori mantığı)
3. `src/app/admin/(protected)/integrations/trendyol/products/attribute-searchable-select.tsx` *(YENİ BİLEŞEN)*
4. `src/app/admin/(protected)/integrations/trendyol/products/trendyol-product-list.tsx` (Yeni modal, arama kutusu ve çoklu kategori seçimi)
5. `src/app/admin/(protected)/integrations/trendyol/batches/trendyol-batch-list.tsx` (`IN_PROGRESS` rozeti ve hata gösterimi)
6. `src/app/api/admin/trendyol/debug/route.ts` (V2 debug testleri)

---

## 🔄 Git ile Hızlı Aktarma (Alternatif Hızlı Yol)

Aynı git geçmişini veya branch'i paylaşıyorsanız doğrudan şu commit aralığını cherry-pick veya patch yapabilirsiniz:
```bash
git cherry-pick 39bec98^..e88f231
```
