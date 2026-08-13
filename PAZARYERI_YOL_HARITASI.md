# E-Ticaret Pazaryeri Entegrasyon ve Ölçeklendirme Yol Haritası

Bu doküman, mevcut B2B/B2C Next.js e-ticaret altyapınızın yüksek performanslı, tıkanmayan ve profesyonel (Enterprise) bir pazar yeri senkronizasyon yeteneğine kavuşması için atılması gereken adımları teknik bir sıra halinde içermektedir.

---

## 🏗️ Faz 1: Altyapı Hazırlığı ve Arka Plan Kuyruk (Queue) Sistemi
Mevcut durumda tüm API işlemlerinin senkron (anlık donmalara yol açarak) ilerlediğini tespit ettik. 7000+ ürünün anında işlenmesi için asenkron (kuyruklu) bir yapı şarttır.

- [x] **Redis Altyapısının Kurulması:** Sunucu (Coolify / Docker) üzerine bir Redis container başlatılacak (Maliyet ve RAM kullanımı son derece düşüktür).
- [x] **BullMQ Kütüphanesinin Projeye Eklenmesi:** Next.js içerisinde `package.json`'a iş parçacıklarını yönetecek kuyruk altyapısı kurulacak.
- [x] **Kuyruk Süreçlerinin (Worker) Yazılması:** Örneğin `updateMarketplacePriceQueue` adında bir worker yazılarak, arka planda ürünleri 100'erli batch'ler halinde Pazar yerlerine (Trendyol, N11) gönderebilmesi sağlanacak.
- [x] **Admin Paneline "Görevler" (Tasks) Arayüzü Eklenmesi:** (Kuyruk Butonlara entegre edildi, ilerleme loglarda takip ediliyor).

---

## 🔄 Faz 2: Kategori, Marka Eşleştirmesi (Mapping) ve Ürün Gönderimi
Şu anda API entegrasyonlarında kategori ID'leri statik (mock/sahte) atanıyor. Ürünlerin başarıyla sergilenmesi için gerçek eşleştirme modülü gereklidir.

- [x] **Kategori Eşleştirme UI/UX:** Admin panelindeki mevcut kategorilerin sağında "Trendyol Kategori Bul", "N11 Kategori Bul" şeklinde seçici arayüzler eklenecek.
- [x] **Marka Eşleştirme (Brand Mapping):** Sistemdeki markalar, her pazar yeri için otomatik sorgulanıp veritabanına (`brand` tablosuna `trendyolBrandId` vs.) kaydedilecek.
- [x] **Product Variant Barcode Düzeltmeleri:** Pazar yerleri kesinlikle barcodsuz varyant kabul etmez. Veritabanındaki ürünlerde eksik barkodların uyarılarak tamamlatılması sağlanacak.
- [x] **Gerçek Veri Gönderim Testi:** Trendyol, N11 ve Hepsiburada için "Ürün Yönetim Paneli" ve "Dinamik Özellik Sihirbazı" (Wizard) tamamlandı. Ürünler sıfırdan pazaryerlerine gönderilebilir durumda.

---

## ⚡ Faz 3: Sipariş & Gerçek Zamanlı Stok Senkronizasyonu
Stoklar arasında "Yok Satma" (Overselling) problemini önleyecek akıllı mimarinin kurulması.

- [x] **Order Created (Sipariş Oluştu) Event'i Yazılması:** Web sitenizden veya N11/Trendyol'dan sipariş geldiği saniye bir *Event* tetiklenecek. (Checkout entegrasyonu tamamlandı).
- [x] **Veritabanı Stok Düşme İşleminin Eklenmesi:** Mevcut kodlardaki eksik giderilecek, satılan ürünün `Product` ve `ProductVariant` tablolarındaki stoğu güvenli bir db Transaction'u ile `-1` eksiltilecek.
- [/] **Webhooks Dinleyicisi (Listener) Tanımlanması:** Pazar yeri sipariş iptalleri (iptal olduysa stoku otomatik geri ekleme) işlemleri dinlenecek. (Trendyol/N11 Webhook rotaları hazırlanıyor).
- [x] **Kritik Stok Fren Sistemi:** Kodlanan mevcut schema'daki `criticalStock` alanına ulaşıldığında ürünü pazar yerlerinde "Tükendi" göstermesi sağlanacak. (Yalnızca kendi kârlı ve asistan sitenizde kalacak).

---

## 🌍 Faz 4: Yeni Pazaryerlerinin (EpttAVM, Pazarama, İdefix) Eklenmesi
Sistem artık sağlam, kuyruklu ve tamamen modüler çalışıyor; Yeni pazaryerleri rahatça entegre edilebilir.

- [x] **EpttAVM:** REST API v1 dokümantasyonuna uygun olarak `PttavmConfig`, `PttavmProduct` ve `PttavmOrder` veritabanı şeması eklendi. `api.ts`, upsert batching (1000 ürün limiti), KDV validasyonu, ürün aktif/pasif canlı API güncellemesi ve sipariş/stok senkronizasyonu tamamlandı.
- [x] **Pazarama:** Pazarama API dokümantasyonu incelenip `PazaramaConfig` ve `sync` fonksiyonları eklendi.
- [x] **Kuyruğa Dahil Etme:** E-ticaret sitenizde stok 1 azaldığında, Background Worker *aynı saniye içinde* "Sırayla N11, Trendyol, Hepsiburada, Idefix, Pazarama ve Epttavm'nin apilerine git ve stoğu eksilt" işlemini yapacak.

---

> **Not:** 
> Yukarıdaki fazlar e-ticaret sitenizi basit bir monolitik uygulamadan, profesyonel (enterprise-grade) dev bir yapıya çıkartacaktır. Projelendirmeye/Geliştirmeye başlanacağı zaman öncelikle **Faz 1 (Kuyruk / Queue)** adımından başlanması tavsiye edilir. Çünkü sağlam bir iş kuyruğu olmadan yapılacak her toplu güncelleme mevcut sistemi kilitleyecektir.
