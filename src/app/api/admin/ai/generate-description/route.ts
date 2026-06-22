import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as cheerio from "cheerio";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const { url, text, productName: reqProductName } = await req.json();

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

    const userPrompt = `Aşağıdaki ham verileri e-ticaret sitemiz için profesyonelce düzenle:
      
      ${productName ? `ÜRÜN ADI: ${productName}` : ""}
      KAYNAK METİN (ÜRETİCİ BİLGİLERİ): 
      ${productDescription}`;

    let generatedHtml = "";

    // 4. Generate Content based on Provider
    if (config.provider === "OPENROUTER" && config.openRouterApiKey) {
        let modelId = config.openRouterModel || "openai/gpt-4o-mini";
        
        // HATA FIX: Veritabanındaki eski ':beta' takısını veya ekleri temizle
        modelId = modelId.replace(":beta", "").trim();

        // Qwen modelleri için artık manuel prefix eklemiyoruz, direkt veritabanındaki ID'yi kullanıyoruz (Nihai Fix: 2026-04-06)
        const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${config.openRouterApiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://bardakcibike.com.tr", 
                "X-Title": "Bardakcı Bike B2C"
            },
            body: JSON.stringify({
                model: modelId,
                temperature: 1.0, // Maksimum yaratıcılık
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ]
            })
        });

        const orData = await orRes.json();
        
        if (orData.error) {
            throw new Error(`OpenRouter Hatası: ${orData.error.message || JSON.stringify(orData.error)}`);
        }
        
        const choice = orData.choices?.[0];
        const message = choice?.message;

        if (message?.refusal) {
            throw new Error(`Yapay Zeka Reddi: ${message.refusal}`);
        }

        generatedHtml = message?.content || "";
        
        if (!generatedHtml) {
            throw new Error("Yapay zeka herhangi bir içerik üretmedi. Lütfen modeli veya sağlayıcıyı değiştirip tekrar deneyin.");
        }

    } else if (config.provider === "GEMINI" && config.apiKey) {
        const genAI = new GoogleGenerativeAI(config.apiKey);
        // Clean model ID for native SDK
        const modelIdFromConfig = config.openRouterModel?.split("/").pop()?.replace(":free", "") || "gemini-1.5-flash";
        
        const model = genAI.getGenerativeModel({ 
            model: modelIdFromConfig,
            systemInstruction: systemPrompt 
        });

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: {
                temperature: 1.0, // Maksimum yaratıcılık
            }
        });
        const aiResponse = await result.response;
        generatedHtml = aiResponse.text();
    }
 else {
        return NextResponse.json({ error: "Seçilen sağlayıcı için API anahtarı eksik." }, { status: 400 });
    }

    // 1. Clean markdown code blocks if AI returns them (case-insensitive)
    generatedHtml = generatedHtml.replace(/```(?:html|HTML|xml|json)?/gi, "").replace(/```/g, "").trim();

    // 2. ABSOLUTE FILTER: Remove any Chinese, Japanese, or Korean characters (CJK) 
    // This is a safety layer for models like Qwen.
    generatedHtml = generatedHtml.replace(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uff00-\uffef]/g, "").trim();

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
