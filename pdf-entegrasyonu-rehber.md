# Next.js PDF Entegrasyonu ve Türkçe Karakter Çözüm Rehberi

Bu rehber, bir Next.js projesinde `@react-pdf/renderer` kütüphanesi kullanarak dinamik PDF'ler üretmeyi, bu PDF'leri e-postalara ek (attachment) olarak eklemeyi ve PDF üretiminde sıkça karşılaşılan **Türkçe karakter (ı, İ, ş, Ş, ğ, Ğ, ç, Ç, ö, Ö, ü, Ü) bozulma sorununu** kalıcı olarak nasıl çözeceğinizi adım adım açıklamaktadır.

---

## 🚀 1. Genel Mimari ve Yapılan İşlem

Sistemde sipariş onaylandığında müşteriye giden onay e-postasına dinamik verilerle (sipariş no, ürün bilgileri, kargo, alıcı/satıcı bilgileri) doldurulmuş **3 adet yasal sözleşme/politika PDF'i** oluşturulup eklenir:
1. **Ön Bilgilendirme Formu** (Dinamik ürün ve fiyat tablosu içerir)
2. **Mesafeli Satış Sözleşmesi** (Dinamik sipariş ve adres verileri içerir)
3. **İptal ve İade Koşulları** (Genel politika metnini içerir)

PDF'ler sunucu tarafında (Server-side) `Buffer` olarak üretilir ve e-posta gönderim servisine (örn: Resend) doğrudan gönderilerek e-postaya iliştirilir. Disk üzerinde herhangi bir geçici dosya oluşturulmaz.

---

## 🛠️ 2. Adım Adım Kurulum ve Entegrasyon Rehberi

### Adım 1: Gerekli Paketlerin Kurulması

Projenize `@react-pdf/renderer` paketini ekleyin:

```bash
npm install @react-pdf/renderer
# veya yarn/pnpm kullanıyorsanız:
yarn add @react-pdf/renderer
pnpm add @react-pdf/renderer
```

---

### Adım 2: Next.js Konfigürasyonu (`next.config.js` veya `next.config.ts`)

`@react-pdf/renderer` kütüphanesi sunucu tarafında bazı C++ ve NodeJS yerel bağımlılıklarını kullanabilir. Next.js'in bu kütüphaneyi istemci (client) tarafındaki bundle'lara dahil etmeye çalışıp hata vermesini engellemek için **harici paket (external package)** olarak tanımlamanız gerekir.

`next.config.ts` (veya `.js`) dosyanıza aşağıdaki satırı ekleyin:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-pdf kütüphanesini sunucu tarafında harici paket olarak tanımlıyoruz
  serverExternalPackages: ['@react-pdf/renderer'],
  
  // Diğer ayarlarınız...
};

export default nextConfig;
```

---

### Adım 3: Türkçe Karakter Sorununun Çözümü (Font Kaydı)

#### Sorun Nedir?
`react-pdf` varsayılan olarak **Helvetica** fontunu kullanır. Helvetica ve benzeri standart batı fontları Türkçe karakterleri (`ğ, Ğ, ı, İ, ş, Ş, ç, Ç, ö, Ö, ü, Ü`) barındırmaz. Bu karakterler PDF üzerinde boşluk, soru işareti (?) veya dikey kutucuk (□) olarak görünür. Google Fonts üzerinden verilen URL bağlantıları da sunucu tarafında ağ/izin hatalarına yol açabildiğinden en garanti yol yerel font dosyası kullanmaktır.

#### Çözüm:
Türkçe karakter setini tam olarak destekleyen bir fontun (Örn: **Noto Sans** veya **Inter**) `.ttf` formatındaki dosyalarını projenize dahil edin.

1. **Fontları İndirin:**
   GitHub üzerindeki resmi Google Fonts deposundan Noto Sans regular ve bold fontlarını indirin:
   - [NotoSans-Regular.ttf](https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf)
   - [NotoSans-Bold.ttf](https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf)

2. **Fontları Projeye Ekleyin:**
   İndirdiğiniz dosyaları projenizin `public/fonts/` klasörüne yerleştirin:
   - `public/fonts/NotoSans-Regular.ttf`
   - `public/fonts/NotoSans-Bold.ttf`

3. **Koda Tanımlayın (`Font.register`):**
   PDF dosyasını oluşturduğunuz kodun en üstünde fontları sisteme kaydedin ve `StyleSheet` içinde bu font ailesini belirtin:

```typescript
import path from 'path';
import { Font, StyleSheet } from '@react-pdf/renderer';

// Projenin kök dizinindeki public klasörünün yolunu alıyoruz
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');

// Fontları react-pdf sistemine kaydediyoruz
Font.register({
    family: 'NotoSans',
    fonts: [
        { src: path.join(FONT_DIR, 'NotoSans-Regular.ttf'), fontWeight: 'normal' },
        { src: path.join(FONT_DIR, 'NotoSans-Bold.ttf'),    fontWeight: 'bold' },
    ],
});

// Stillerde kullanıyoruz
const styles = StyleSheet.create({
    page: {
        fontFamily: 'NotoSans', // Kaydettiğimiz ismi birebir yazmalıyız
        fontSize: 9,
        padding: 30,
    },
    boldText: {
        fontWeight: 'bold', // Bold font otomatik olarak NotoSans-Bold.ttf dosyasından çekilir
    }
});
```

---

### Adım 4: Örnek PDF Bileşeni ve Buffer Üretici Kodu

Aşağıdaki örnek, dinamik parametreler alan ve Türkçe karakter desteğiyle sunucu tarafında PDF üreten bir dosya yapısıdır. Bu dosyayı örneğin `src/lib/pdf-generator.tsx` adıyla oluşturabilirsiniz:

```tsx
import React from 'react';
import path from 'path';
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font,
    renderToBuffer,
} from '@react-pdf/renderer';

// 1. Font Kaydı
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');
Font.register({
    family: 'NotoSans',
    fonts: [
        { src: path.join(FONT_DIR, 'NotoSans-Regular.ttf'), fontWeight: 'normal' },
        { src: path.join(FONT_DIR, 'NotoSans-Bold.ttf'),    fontWeight: 'bold' },
    ],
});

// 2. Tasarım Stilleri
const styles = StyleSheet.create({
    page: {
        fontFamily: 'NotoSans',
        fontSize: 10,
        padding: 40,
        lineHeight: 1.5,
    },
    header: {
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 5,
    },
    label: {
        fontWeight: 'bold',
        width: 120,
    },
    value: {
        flex: 1,
    }
});

// 3. Props Tanımı
interface SamplePdfProps {
    orderNumber: string;
    customerName: string;
    totalAmount: number;
}

// 4. React-PDF Bileşeni
const SamplePdfDocument: React.FC<SamplePdfProps> = ({ orderNumber, customerName, totalAmount }) => {
    return (
        <Document title={`Siparis-${orderNumber}`}>
            <Page size="A4" style={styles.page}>
                <Text style={styles.header}>SİPARİŞ DETAY FORMU</Text>
                
                <View style={styles.row}>
                    <Text style={styles.label}>Sipariş No:</Text>
                    <Text style={styles.value}>{orderNumber}</Text>
                </View>
                
                <View style={styles.row}>
                    <Text style={styles.label}>Müşteri Adı:</Text>
                    {/* Türkçe karakterler (ş, ı, ğ vb.) burada sorunsuz render edilecektir */}
                    <Text style={styles.value}>{customerName}</Text>
                </View>
                
                <View style={styles.row}>
                    <Text style={styles.label}>Toplam Tutar:</Text>
                    <Text style={styles.value}>{totalAmount} TL</Text>
                </View>
            </Page>
        </Document>
    );
};

// 5. Buffer Üretici Fonksiyon
// Bu fonksiyon çağrıldığında bellekte PDF'i derler ve Buffer olarak döner.
export async function generateSamplePdf(props: SamplePdfProps): Promise<Buffer> {
    return renderToBuffer(
        <SamplePdfDocument {...props} />
    ) as Promise<Buffer>;
}
```

---

### Adım 5: PDF'i E-postaya Attachment Olarak Eklemek (Resend Örneği)

Üretilen PDF buffer'ını e-posta gönderme servislerine (Resend, Nodemailer vb.) doğrudan binary formatta ek olarak besleyebilirsiniz.

Aşağıda `Promise.allSettled` yapısı kullanarak PDF üretim hatası olsa dahi ana e-posta gönderim işleminin yarıda kalmamasını sağlayan güvenli entegrasyon şablonu yer almaktadır:

```typescript
import { Resend } from 'resend';
import { generateSamplePdf } from '@/lib/pdf-generator';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendMailParams {
    to: string;
    orderNumber: string;
    customerName: string;
    totalAmount: number;
}

export async function sendEmailWithPdf(params: SendMailParams) {
    try {
        // PDF'leri paralel olarak üret. 
        // allSettled sayesinde biri çökerse diğerleri ve ana e-posta akışı durmaz.
        const [pdfResult] = await Promise.allSettled([
            generateSamplePdf({
                orderNumber: params.orderNumber,
                customerName: params.customerName,
                totalAmount: params.totalAmount,
            })
        ]);

        const attachments: { filename: string; content: Buffer }[] = [];

        // PDF üretimi başarılıysa ekler listesine ekle
        if (pdfResult.status === 'fulfilled') {
            attachments.push({
                filename: `siparis-detay-${params.orderNumber}.pdf`,
                content: pdfResult.value, // renderToBuffer'dan dönen Buffer nesnesi
            });
        } else {
            console.error('PDF üretilirken hata oluştu:', pdfResult.reason);
        }

        // Resend veya Nodemailer ile gönderim
        const { data, error } = await resend.emails.send({
            from: 'Sipariş <siparis@siteniz.com>',
            to: [params.to],
            subject: `Siparişiniz Alındı - #${params.orderNumber}`,
            html: `<p>Merhaba ${params.customerName}, siparişiniz onaylandı. Ekler kısmından yasal bilgilendirme formunuza ulaşabilirsiniz.</p>`,
            // Eğer PDF üretilemediyse attachments alanı boş gider ama e-posta ulaşıyor olur.
            attachments: attachments.length > 0 ? attachments : undefined,
        });

        if (error) {
            return { success: false, error };
        }
        return { success: true, data };
        
    } catch (error) {
        console.error('E-posta gönderim hatası:', error);
        return { success: false, error };
    }
}
```

---

## 📌 Altın Kurallar & Dikkat Edilmesi Gerekenler

1. **`path.join` Kullanımı:** Font yolunu belirtirken `process.cwd()` ile birlikte `path.join` kullanmak en güvenli yoldur. Klasör hiyerarşisi sunucuda (Vercel, Docker vb.) değişse bile çalışmaya devam eder.
2. **`renderToBuffer`:** react-pdf'in tarayıcı taraflı metotları (BlobProvider, PDFDownloadLink vb.) Next.js'in sunucu bileşenlerinde (`use server` / API routes) çalışmaz. Sunucu tarafında her zaman `@react-pdf/renderer` içerisindeki `renderToBuffer` kullanılmalıdır.
3. **`fontWeight` Eşleşmesi:** Fontu kaydederken `fontWeight: 'bold'` olarak tanımladıysanız, bileşenin stil dosyasında da mutlaka `fontWeight: 'bold'` yazmalısınız. Eğer sadece `fontWeight: 700` veya farklı bir değer yazarsanız, kütüphane bold font dosyasını eşleştiremeyip regular fontu kalınlaştırmaya çalışabilir veya hata verebilir.
4. **Resend Limitleri:** Resend üzerinden gönderilen eklerin boyutu (payload boyutu) limitlere tabidir. Tasarımlarda çok yüksek çözünürlüklü görseller kullanmaktan kaçınarak PDF boyutlarını minimal tutmak avantajlıdır.
