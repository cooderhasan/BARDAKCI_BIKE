import { ActiveStore } from "@/lib/store-helper";

export interface PolicyData {
  slug: string;
  title: string;
  content: string;
}

export function adaptTextForStore(text: string, storeType: ActiveStore): string {
  if (storeType !== "MOTOR") return text;

  return text
    .replace(/Bardakçı Bisiklet/g, "Motovitrin Motosiklet")
    .replace(/Bardakcı Bisiklet/g, "Motovitrin Motosiklet")
    .replace(/Bardakçı Bike/g, "Moto Vitrin")
    .replace(/Bardakcı Bike/g, "Moto Vitrin")
    .replace(/Bardakci Bike/g, "Moto Vitrin")
    .replace(/BARDAKCI BIKE/g, "MOTO VİTRİN")
    .replace(/bardakcibike\.com\.tr/g, "motovitrin.com")
    .replace(/info@bardakcibike\.com\.tr/g, "info@motovitrin.com")
    .replace(/bisiklet ve bisiklet yedek parça/gi, "motosiklet, motosiklet yedek parça ve aksesuar")
    .replace(/bisiklet yedek parçaları/gi, "motosiklet yedek parçaları")
    .replace(/bisiklet yedek parça/gi, "motosiklet yedek parça")
    .replace(/bisikletler/gi, "motosikletler")
    .replace(/bisiklet/g, "motosiklet")
    .replace(/Bisiklet/g, "Motosiklet");
}

export function getDefaultPolicy(slug: string, storeType: ActiveStore): PolicyData | null {
  const isMotor = storeType === "MOTOR";
  const brandName = isMotor ? "Moto Vitrin" : "Bardakçı Bike";
  const domainName = isMotor ? "motovitrin.com" : "bardakcibike.com.tr";
  const contactEmail = isMotor ? "info@motovitrin.com" : "info@bardakcibike.com.tr";
  const sectorTerm = isMotor ? "motosiklet, motosiklet yedek parça ve aksesuarları" : "bisiklet ve yedek parçaları";

  const defaultPolicies: Record<string, { title: string; content: string }> = {
    privacy: {
      title: "Gizlilik Politikası",
      content: `
        <h2>1. Gizlilik Bildirimi</h2>
        <p><strong>${brandName}</strong> (${domainName}) olarak, kullanıcılarımızın ve müşterilerimizin kişisel verilerinin gizliliğine ve güvenliğine büyük önem veriyoruz. Bu Gizlilik Politikası, web sitemizi ziyaret ettiğinizde veya alışveriş yaptığınızda kişisel verilerinizin nasıl toplandığını, kullanıldığını ve korunduğunu açıklamaktadır.</p>
        
        <h2>2. Toplanan Veriler</h2>
        <p>Hizmetlerimizi sunabilmek amacıyla aşağıdaki veriler toplanabilir:</p>
        <ul>
          <li>Ad, soyad, T.C. Kimlik / VKN numarası ve fatura bilgileri</li>
          <li>E-posta adresi, telefon numarası ve teslimat adresi</li>
          <li>Sipariş geçmişi, ödeme ve kargo takip bilgileri</li>
          <li>IP adresi, çerezler ve tarayıcı erişim logları</li>
        </ul>

        <h2>3. Verilerin Kullanım Amaçları</h2>
        <p>Toplanan kişisel verileriniz;</p>
        <ul>
          <li>Siparişlerin işlenmesi, faturalandırılması ve teslimatının sağlanması,</li>
          <li>Müşteri destek süreçlerinin yürütülmesi ve taleplerinizin karşılanması,</li>
          <li>Yasal yükümlülüklerin yerine getirilmesi,</li>
          <li>Onay vermeniz halinde kampanya, indirim ve duyuruların iletilmesi</li>
        </ul>
        <p>amaçlarıyla işlenmektedir.</p>

        <h2>4. Veri Güvenliği ve Paylaşım</h2>
        <p>Kişisel verileriniz yasal zorunluluklar ve sipariş teslimat süreçleri (kargo firmaları, ödeme kuruluşları) dışında üçüncü şahıslarla asla paylaşılmaz ve satılmaz. Sistemlerimizde en güncel SSL şifreleme ve veri güvenliği standartları uygulanmaktadır.</p>

        <h2>5. İletişim</h2>
        <p>Gizlilik politikamızla ilgili tüm soru ve talepleriniz için <strong>${contactEmail}</strong> adresi üzerinden bizimle iletişime geçebilirsiniz.</p>
      `,
    },
    kvkk: {
      title: "KVKK Aydınlatma Metni",
      content: `
        <h2>6698 Sayılı KVKK Uyarınca Aydınlatma Metni</h2>
        <p><strong>${brandName}</strong> olarak 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, Veri Sorumlusu sıfatıyla siz değerli müşterilerimizin kişisel verilerini kanuna uygun olarak işlemekteyiz.</p>

        <h2>1. İşlenen Kişisel Verileriniz ve İşlenme Amaçları</h2>
        <p>Kimlik, iletişim, müşteri işlem ve finansal verileriniz; ürün ve hizmetlerimizin sunulması, sözleşme süreçlerinin yürütülmesi, faturalandırma ve kargo teslimat işlemlerinin gerçekleştirilmesi amacıyla işlenmektedir.</p>

        <h2>2. Kişisel Verilerin Aktarılması</h2>
        <p>Verileriniz, yalnızca mevzuatın izin verdiği hallerde yetkili kamu kurum ve kuruluşları, anlaşmalı kargo şirketleri ve lisanslı ödeme altyapı sağlayıcıları ile paylaşılabilmektedir.</p>

        <h2>3. KVKK Kapsamındaki Haklarınız</h2>
        <p>KVKK'nın 11. maddesi uyarınca veri sahibi olarak;</p>
        <ul>
          <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme,</li>
          <li>İşlenmişse buna ilişkin bilgi talep etme,</li>
          <li>Verilerin düzeltilmesini veya silinmesini isteme,</li>
          <li>İşleme amacına uygun kullanılıp kullanılmadığını öğrenme</li>
        </ul>
        <p>haklarına sahipsiniz. Başvurularınızı <strong>${contactEmail}</strong> e-posta adresimize iletebilirsiniz.</p>
      `,
    },
    "distance-sales": {
      title: "Mesafeli Satış Sözleşmesi",
      content: `
        <h2>MADDE 1 - TARAFLAR</h2>
        <p><strong>SATICI:</strong> ${brandName} (${domainName})<br />
        <strong>E-Posta:</strong> ${contactEmail}<br />
        <strong>Konu:</strong> Alıcının Satıcıya ait internet sitesinden elektronik ortamda siparişini yaptığı ${sectorTerm} ürünlerinin satışı ve teslimi ile ilgili hak ve yükümlülükler.</p>

        <h2>MADDE 2 - SÖZLEŞMENİN KONUSU</h2>
        <p>İşbu sözleşmenin konusu, ALICI'nın SATICI'ya ait internet sitesinden sipariş verdiği ürünün satışı, fiyatı, ödemesi ve teslimat koşullarının 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince düzenlenmesidir.</p>

        <h2>MADDE 3 - CAYMA HAKKI VE İADE</h2>
        <p>ALICI, ürünü teslim aldığı tarihten itibaren 14 (on dört) gün içinde herhangi bir gerekçe göstermeksizin cayma hakkını kullanabilir. İade edilecek ürünün ambalajının açılmamış, kullanılmamış ve yeniden satılabilir durumda olması gerekmektedir.</p>

        <h2>MADDE 4 - YETKİLİ MAHKEME</h2>
        <p>İşbu sözleşmenin uygulanmasında Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir.</p>
      `,
    },
    cookies: {
      title: "Çerez (Cookie) Politikası",
      content: `
        <h2>Çerez Politikası ve Kullanım İlkeleri</h2>
        <p><strong>${brandName}</strong> olarak web sitemizde (${domainName}) en iyi deneyimi sunabilmek amacıyla çerezler (cookies) kullanmaktayız.</p>

        <h2>1. Çerez Nedir?</h2>
        <p>Çerezler, bir web sitesini ziyaret ettiğinizde tarayıcınız aracılığıyla cihazınıza kaydedilen küçük metin dosyalarıdır.</p>

        <h2>2. Kullanılan Çerez Türleri</h2>
        <ul>
          <li><strong>Zorunlu Çerezler:</strong> Oturum açma, sepet yönetimi ve güvenli alışveriş için gereklidir.</li>
          <li><strong>Performans Çerezleri:</strong> Sitenin hızını ve kullanım istatistiklerini analiz etmemizi sağlar.</li>
          <li><strong>Pazarlama Çerezleri:</strong> İlgi alanlarınıza uygun fırsat ve duyuruları sunmak için kullanılır.</li>
        </ul>

        <h2>3. Çerez Tercihlerini Değiştirme</h2>
        <p>Tarayıcı ayarlarınız üzerinden dilediğiniz zaman çerezleri engelleyebilir veya silebilirsiniz.</p>
      `,
    },
    "payment-methods": {
      title: "Ödeme Yöntemleri",
      content: `
        <h2>Güvenli Ödeme Seçenekleri</h2>
        <p><strong>${brandName}</strong> mağazamızda sunulan tüm ödeme yöntemleri 256-bit SSL sertifikası ile korunan lisanslı altyapılar üzerinden gerçekleştirilir.</p>

        <h2>1. Kredi ve Banka Kartı</h2>
        <p>Tüm Visa, Mastercard ve Troy özellikli kredi/banka kartları ile güvenle ödeme yapabilirsiniz. Anlaşmalı banka kartlarına taksit imkanı sunulmaktadır.</p>

        <h2>2. Havale / EFT</h2>
        <p>Siparişinizi tamamladıktan sonra belirtilen IBAN hesabımıza Havale/EFT ile ödeme gerçekleştirebilirsiniz. Açıklama kısmına sipariş numaranızı yazmanız yeterlidir.</p>

        <h2>3. Cari / Bayi Hesabı</h2>
        <p>Onaylı bayilerimiz için tanımlanan cari limit ve indirim oranları üzerinden sipariş oluşturulabilmektedir.</p>
      `,
    },
    cancellation: {
      title: "İptal ve İade Koşulları",
      content: `
        <h2>İptal ve İade İşlemleri</h2>
        <p><strong>${brandName}</strong> üzerinden verdiğiniz siparişleri kargoya verilmeden önce dilediğiniz zaman ücretsiz iptal edebilirsiniz.</p>

        <h2>İade Koşulları</h2>
        <ul>
          <li>Ürünü teslim aldığınız tarihten itibaren 14 gün içerisinde iade talebi oluşturabilirsiniz.</li>
          <li>İade edilecek ürünün orijinal kutusu, faturası ve tüm aksesuarları tam olmalıdır.</li>
          <li>Montajı yapılmış, çizilmiş veya hasar görmüş ürünlerin iadesi kabul edilmemektedir.</li>
        </ul>
        <p>İade talepleriniz için <strong>${contactEmail}</strong> veya müşteri hizmetlerimizle iletişime geçebilirsiniz.</p>
      `,
    },
    "commercial-communication": {
      title: "Ticari Elektronik İleti Onayı",
      content: `
        <h2>Ticari Elektronik İleti Onay Metni</h2>
        <p><strong>${brandName}</strong> tarafından sunulan ürün, hizmet, indirim, kampanya ve duyurulardan haberdar olmak amacıyla iletişim bilgilerimin (E-posta, SMS) işlenmesine ve bana ticari elektronik ileti gönderilmesine onay veriyorum.</p>
        <p>Dilediğiniz zaman gönderilen iletilerdeki "Üyelikten Çık" bağlantısını kullanarak veya <strong>${contactEmail}</strong> adresine bildirimde bulunarak izin onayınızı iptal edebilirsiniz.</p>
      `,
    },
    membership: {
      title: "Üyelik ve Bayilik Sözleşmesi",
      content: `
        <h2>Üyelik ve Bayilik Kullanım Koşulları</h2>
        <p><strong>${brandName}</strong> B2B/B2C platformuna üye olarak veya bayi başvurusu yaparak işbu sözleşme koşullarını kabul etmiş olursunuz.</p>
        
        <h2>1. Üyelik Şartları</h2>
        <p>Üye, kayıt formunda sunduğu bilgilerin doğru olduğunu kabul eder. B2B Bayi başvurularında firma VKN/Vergi levhası doğrulaması zorunludur.</p>

        <h2>2. Gizlilik ve Hesap Güvenliği</h2>
        <p>Kullanıcı adı ve şifre güvenliği üyeye aittir. Hesabınız üzerinden yapılan tüm işlemlerden üye sorumludur.</p>

        <h2>3. Fiyatlandırma ve Stok</h2>
        <p>Toptan bayi fiyatları ve özel iskonto grupları yalnızca onaylı bayilere özel tanımlanır.</p>
      `,
    },
  };

  const rawPolicy = defaultPolicies[slug];
  if (!rawPolicy) return null;

  return {
    slug,
    title: rawPolicy.title,
    content: rawPolicy.content,
  };
}
