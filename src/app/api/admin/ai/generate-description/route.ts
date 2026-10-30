import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import * as cheerio from "cheerio";

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  try {
    // mode "marketplace": pazaryeri için kısa açıklama (tablo yok, site metninden farklı cümleler); avoidText: sitedeki açıklama
    const { url, text, productName: reqProductName, mode, avoidText } = await req.json();
    const isMarketplace = mode === "marketplace";

    let productName = reqProductName || "";
    let productDescription = text || "";

    // 1. Get AI Configuration
    const config = await prisma.geminiConfig.findFirst({
        where: { isActive: true }
    });

    if (!config) {
      return NextResponse.json({ error: "Yapay Zeka (AI) yapılandırılmamış veya aktif değil." }, { status: 400 });
    }

    // 2. Fetch Page Content if URL is provided and no text is present
    if (!text && url) {
        let response;
        try {
            response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Referer': 'https://www.google.com/',
                },
                next: { revalidate: 0 }
            });
        } catch (err: any) {
            return NextResponse.json({ 
                success: false, 
                error: `Kaynak siteye erişilirken ağ hatası oluştu: ${err.message || "Bilinmeyen ağ hatası"}` 
            }, { status: 500 });
        }

        if (!response.ok) {
            return NextResponse.json({ 
                success: false, 
                error: `Kaynak siteye ulaşılamadı (Hata Kodu: ${response.status}). Site botu engellemiş olabilir.` 
            }, { status: 400 });
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract Data
        productName = $("h1").first().text().trim();

        if (url.includes("ladaci.com")) {
            productDescription = $("#tab-description").text().trim() || $(".product-description").text().trim();
        } else if (url.includes("aslaneroto.com")) {
            productDescription = $("#tabs-1").text().trim() || $(".product-description").text().trim();
        } else {
            productDescription = $(".product-description").text().trim() || 
                                 $("#description").text().trim() || 
                                 $("article").text().trim() || 
                                 $("meta[name='description']").attr("content") || "";
        }
    }

    if (!productDescription) {
        return NextResponse.json({ error: "Lütfen düzeltilecek ham metni veya geçerli bir URL girin." }, { status: 400 });
    }

    const systemPrompt = `Sen profesyonel bir Bisiklet, Bisiklet Parçaları ve Aksesuarları Teknik Danışmanı ve E-ticaret SEO İçerik Uzmanısın. 
    Görevin; üretici sitelerinden kopyalanmış ham, karışık veya düzensiz ürün bilgilerini düzenlemek, profesyonel bir üslupla e-ticaret siteleri için SEO uyumlu bir açıklama metnine dönüştürmek ve teknik özellikler tablosu oluşturmaktır.

    NİHAİ YAZIM VE FORMAT KURALLARI:
    1. YAPI (STRUCTURE): 
       - Önce ürünün ne işe yaradığını, kalitesini ve önemini anlatan profesyonel tanıtım paragrafları.
       - Ardından "Öne Çıkan Özellikler" veya "Avantajları" başlığı altında madde madde özellikler.
       - En sonda ise "Teknik Özellikler" başlığı altında bir Teknik Tablo gelmelidir.
    2. VURGULAMA (BOLD): Önemli teknik özellikleri, uyumluluk detaylarını (jant ölçüsü, malzeme, parça tipi vb.) ve kritik avantajları <b>...</b> etiketleri içinde vurgula.
    3. MADDELEME (LISTING): Özellikler bölümünü mutlaka <ul> ve <li> etiketlerini kullanarak liste halinde yaz.
    4. ÜSLUP: Kesinlikle kişisel, samimi veya usta ağzı ifadeler kullanma. Tamamen kurumsal, ikna edici ve profesyonel bir e-ticaret dili kullan.
    5. GARANTİ YASAĞI: Metnin hiçbir yerinde KESİNLİKLE "garanti", "garantilidir", "garantisi vardır" veya benzeri bir garanti taahhüdü içeren ifade kullanma.
    6. TEKNİK TABLO: Yapıştırılan metinden çıkarabildiğin tüm teknik detayları (Malzeme, Boyut, Jant Boyutu, Ağırlık, Renk, Uyumluluk vb.) içeren şık ve standart bir HTML <table> yapısı oluştur. Tabloda <thead> (<th> kullanarak) ve <tbody> (<td> kullanarak) bölümlerini mutlaka ayır. Eğer girdi metninde hiç teknik detay yoksa ürünün adından yola çıkarak mantıklı varsayılan teknik özelliklerle bir tablo oluştur.
    7. HTML BİÇİMİ: Çıktıyı doğrudan HTML formatında ver. Ekstra markdown işaretlemeleri (\`\`\`html vb.) kullanma.`;

    const siteUserPrompt = `Aşağıdaki ham verileri e-ticaret sitemiz için profesyonelce düzenle:

      ${productName ? `ÜRÜN ADI: ${productName}` : ""}
      KAYNAK METİN (ÜRETİCİ BİLGİLERİ):
      ${productDescription}`;

    // Pazaryeri (Trendyol, Hepsiburada vb.) için kısa sürüm: sitedeki açıklamanın kopyası olmasın (kopya içerik),
    // teknik tablo yok (tablo sitede), pazaryerlerinin yasakladığı yönlendirmeler (site adresi, telefon, mağaza adı) yok
    const marketplaceSystemPrompt = `Sen pazaryerleri (Trendyol, Hepsiburada, N11 vb.) için ürün açıklaması yazan profesyonel bir e-ticaret içerik uzmanısın.

    KURALLAR:
    1. UZUNLUK: Kısa ve öz. Toplam 80-150 kelime: 1-2 kısa tanıtım paragrafı ve ardından 4-6 maddelik öne çıkan özellikler listesi.
    2. TABLO YASAK: Kesinlikle <table> kullanma, "Teknik Özellikler" başlığı ekleme.
    3. ÖZGÜNLÜK: Sana verilen "SİTE AÇIKLAMASI" ile aynı cümleleri, aynı giriş cümlesini ve aynı sıralamayı KULLANMA. Aynı bilgileri farklı kelimelerle, farklı bir sırayla ve farklı bir bakış açısıyla (kullanıcıya sağladığı fayda) anlat. Hiçbir cümleyi kopyalama.
    4. YÖNLENDİRME YASAK: Web sitesi adresi, link, telefon, e-posta, WhatsApp, mağaza/firma adı, "sitemizden", "mağazamızdan" gibi ifadeler kullanma.
    5. GARANTİ YASAĞI: "garanti", "garantili" gibi ifadeler kullanma.
    6. VURGULAMA: Önemli özellikleri <b>...</b> ile vurgula; özellikleri <ul><li> ile listele; paragraflar <p>.
    7. BAŞLIK: <h1>/<h2> kullanma.
    8. ÜSLUP: Kurumsal, ikna edici, profesyonel. Kişisel veya usta ağzı ifadeler yok.
    9. HTML BİÇİMİ: Çıktıyı doğrudan HTML olarak ver; markdown kod bloğu kullanma.`;

    const plain = (h: string) => String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const avoidBlock = avoidText
        ? `\n      SİTE AÇIKLAMASI (bundan FARKLI yaz, cümle kopyalama):\n      ${plain(avoidText).slice(0, 4000)}`
        : "";
    const marketplaceUserPrompt = `Aşağıdaki ürün için pazaryeri açıklaması yaz:

      ${productName ? `ÜRÜN ADI: ${productName}` : ""}
      KAYNAK METİN (ÜRETİCİ BİLGİLERİ):
      ${productDescription}${avoidBlock}`;

    const activeSystemPrompt = isMarketplace ? marketplaceSystemPrompt : systemPrompt;
    const userPrompt = isMarketplace ? marketplaceUserPrompt : siteUserPrompt;

    // Sağlayıcı (OpenRouter/Gemini) çağrısı ve kod bloğu/CJK temizliği ortak: lib/ai-generate (kategori açıklaması da kullanıyor)
    const { generateAiHtml } = await import("@/lib/ai-generate");
    let generatedHtml = await generateAiHtml(activeSystemPrompt, userPrompt);

    // Pazaryeri metninde tablo kalmasın (model kurala uymazsa)
    if (isMarketplace) generatedHtml = generatedHtml.replace(/<table[\s\S]*?<\/table>/gi, "").trim();

    return NextResponse.json({
        success: true,
        data: generatedHtml,
        sourceName: productName
    });

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return NextResponse.json({ error: "İşlem sırasında bir hata oluştu: " + error.message }, { status: 500 });
  }
}
