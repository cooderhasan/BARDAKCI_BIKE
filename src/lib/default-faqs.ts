import { ActiveStore } from "@/lib/store-helper";
import { adaptTextForStore } from "@/lib/default-policies";

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isActive: boolean;
}

export function getDefaultFAQs(storeType: ActiveStore): FAQItem[] {
  const isMotor = storeType === "MOTOR";

  if (isMotor) {
    return [
      {
        id: "faq-m1",
        category: "membership",
        question: "Motovitrin bayi (B2B) üyeliği nasıl oluşturulur?",
        answer: "Kurumsal motosiklet yedek parça satıcıları ve tamircileri için hazırlanan B2B sistemimize 'Bayi Kaydı' formunu doldurarak ve Vergi Levhanızı yükleyerek hemen başvurabilirsiniz. Ekibimiz başvurunuzu kısa sürede onaylayıp toptan indirimli fiyatlarınızı aktifleştirecektir.",
        order: 1,
        isActive: true,
      },
      {
        id: "faq-m2",
        category: "membership",
        question: "Bireysel alışveriş yapabilir miyim?",
        answer: "Evet, Motovitrin üzerinden perakende müşteri olarak da güvenle motosiklet yedek parça, kask, ekipman ve aksesuarları satın alabilirsiniz.",
        order: 2,
        isActive: true,
      },
      {
        id: "faq-m3",
        category: "orders",
        question: "Sattığınız motosiklet yedek parçaları orijinal mi?",
        answer: "Motovitrin'de satılan tüm motosiklet yedek parça ve aksesuarları %100 orijinal, garantili ve lisanslı üreticilerden temin edilmektedir.",
        order: 3,
        isActive: true,
      },
      {
        id: "faq-m4",
        category: "orders",
        question: "Motosikletim için doğru parçayı nasıl seçebilirim?",
        answer: "Ürün sayfalarımızdaki marka, model ve yıl uyum tablolarını inceleyebilir veya 0554 014 41 42 numaralı destek hattımızdan uzman teknik ekibimizle görüşerek ruhsat bilginize göre parçayı doğrulayabilirsiniz.",
        order: 4,
        isActive: true,
      },
      {
        id: "faq-m5",
        category: "shipping",
        question: "Motosiklet parçalarında kargo ücreti nasıl hesaplanır?",
        answer: "Motosiklet yedek parça ve aksesuarlarında kargo ücreti paketinizin desisi (ağırlık/hacim) baz alınarak şeffaf şekilde ödeme adımında hesaplanır. Anlaşmalı kargo firmalarımızla (Yurtiçi, Aras, Sürat vb.) en hızlı şekilde adresinize teslim edilir.",
        order: 5,
        isActive: true,
      },
      {
        id: "faq-m6",
        category: "shipping",
        question: "Siparişim ne zaman kargoya verilir?",
        answer: "Hafta içi saat 16:00'ya kadar verilen motor yedek parça siparişleri aynı gün kargoya teslim edilmektedir. Kargo takip numaranız SMS ve E-posta ile tarafınıza iletilir.",
        order: 6,
        isActive: true,
      },
      {
        id: "faq-m7",
        category: "service",
        question: "Uyumsuz gelen veya yanlış sipariş ettiğim parçayı iade edebilir miyim?",
        answer: "Teslimat tarihinden itibaren 14 gün içinde ambalajı bozulmamış, takılmamış ve çizilmemiş ürünleri faturasıyla birlikte ücretsiz iade edebilir veya değişim talep edebilirsiniz.",
        order: 7,
        isActive: true,
      },
      {
        id: "faq-m8",
        category: "service",
        question: "Garantili ürünlerde süreç nasıl işler?",
        answer: "Akü, elektrik aksamı, silindir setleri gibi garantili parçalarda yaşanabilecek teknik problemlerde yetkili teknik servis raporu ile birebir değişim veya garanti hakkı sunulmaktadır.",
        order: 8,
        isActive: true,
      },
    ];
  }

  // Default BIKE FAQs
  return [
    {
      id: "faq-b1",
      category: "membership",
      question: "Bardakçı Bike bayi (B2B) üyeliği nasıl oluşturulur?",
      answer: "Bisiklet mağazaları ve yetkili servisler için tasarlanan B2B sistemimize 'Bayi Başvurusu' bölümünden Vergi Levhanız ile kaydolabilirsiniz. Başvurunuz onaylandığında özel bayi iskontolarınız tanımlanacaktır.",
      order: 1,
      isActive: true,
    },
    {
      id: "faq-b2",
      category: "orders",
      question: "Bisiklet siparişlerinde ödeme seçenekleri nelerdir?",
      answer: "Kredi kartına taksit, Havale/EFT ve onaylı bayiler için Cari Hesaptan ödeme seçenekleri mevcuttur.",
      order: 2,
      isActive: true,
    },
    {
      id: "faq-b3",
      category: "shipping",
      question: "Bisiklet ve yedek parça kargo teslimat süresi nedir?",
      answer: "Siparişleriniz aynı gün veya en geç 24 saat içerisinde anlaşmalı kargolarımızla yola çıkar. Bisiklet siparişlerinde Türkiye geneli ücretsiz kargo avantajı sunulmaktadır.",
      order: 3,
      isActive: true,
    },
    {
      id: "faq-b4",
      category: "service",
      question: "Satın aldığım bisikletin garantisi ve kurulumu nasıl yapılır?",
      answer: "Tüm bisikletlerimiz üretici firma garantisi altındadır. Yetkili servislerde ücretsiz ilk kurulum hizmetinden faydalanabilirsiniz.",
      order: 4,
      isActive: true,
    },
  ];
}

export function adaptFAQForStore(faqs: FAQItem[], storeType: ActiveStore): FAQItem[] {
  return faqs.map((f) => ({
    ...f,
    question: adaptTextForStore(f.question, storeType),
    answer: adaptTextForStore(f.answer, storeType),
  }));
}
