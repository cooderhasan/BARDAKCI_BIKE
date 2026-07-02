import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
    }

    const { title } = await req.json();

    if (!title) {
        return NextResponse.json({ error: "Lütfen bir blog başlığı girin." }, { status: 400 });
    }

    // 1. Get AI Configuration
    const config = await prisma.geminiConfig.findFirst({
        where: { isActive: true }
    });

    if (!config) {
      return NextResponse.json({ error: "Yapay Zeka (AI) yapılandırılmamış veya aktif değil." }, { status: 400 });
    }

    const systemPrompt = `Sen profesyonel bir bisiklet kültürü yazarı, bisiklet mekanisyeni ve e-ticaret SEO içerik uzmanısın.
    Görevin; verilen başlığa uygun olarak, hem okuyucuyu bilgilendirecek, hem de arama motorlarında üst sıralara çıkacak SEO uyumlu, profesyonel, akıcı ve bilgilendirici bir Türkçe blog yazısı yazmaktır.

    NİHAİ YAZIM VE FORMAT KURALLARI:
    1. YAPI (STRUCTURE): 
       - Başlangıçta konunun önemini anlatan ve okuyucunun ilgisini çeken kısa ve vurucu bir giriş paragrafı.
       - Ardından hiyerarşik alt başlıklar (<h2>, <h3> kullanarak) altında konuyu derinlemesine ele alan paragraflar.
       - Önemli listelemeler ve maddeler için mutlaka <ul> ve <li> etiketlerini kullan.
       - Okuyucuya faydalı pratik ipuçları için şık kutu formatları (örneğin <div class="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-xl my-4">...</div>) kullan.
       - Sonuç bölümünde yazıyı özetle ve okuyucuyu dükkanımızda (Bardakcı Bisiklet) satılan ilgili ürün gruplarını incelemeye yönlendir.
    2. VURGULAMA (BOLD): Önemli anahtar kelimeleri ve teknik terimleri <b>...</b> veya <strong>...</strong> etiketleri içinde vurgula.
    3. ÜSLUP: Samimi ama son derece bilgili, profesyonel, anlaşılır ve akıcı bir Türkçe kullan.
    4. UZUNLUK: Yazı en az 600-800 kelime uzunluğunda, detaylı ve doyurucu olmalıdır.
    5. HTML BİÇİMİ: Çıktıyı doğrudan HTML formatında ver. Ekstra markdown işaretlemeleri (\`\`\`html vb.) kullanma.`;

    const userPrompt = `Lütfen şu başlıkta kapsamlı, SEO uyumlu bir blog yazısı oluştur: "${title}"`;

    let generatedHtml = "";

    // Generate Content based on Provider
    if (config.provider === "OPENROUTER" && config.openRouterApiKey) {
        let modelId = config.openRouterModel || "openai/gpt-4o-mini";
        modelId = modelId.replace(":beta", "").trim();

        const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${config.openRouterApiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://bardakcibike.com.tr", 
                "X-Title": "Bardakci Bike B2C"
            },
            body: JSON.stringify({
                model: modelId,
                temperature: 0.9,
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
        
        generatedHtml = orData.choices?.[0]?.message?.content || "";
        
    } else if (config.provider === "GEMINI" && config.apiKey) {
        const genAI = new GoogleGenerativeAI(config.apiKey);
        const modelIdFromConfig = config.openRouterModel?.split("/").pop()?.replace(":free", "") || "gemini-1.5-flash";
        
        const model = genAI.getGenerativeModel({ 
            model: modelIdFromConfig,
            systemInstruction: systemPrompt 
        });

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: {
                temperature: 0.9,
            }
        });
        const aiResponse = await result.response;
        generatedHtml = aiResponse.text();
    } else {
        return NextResponse.json({ error: "Seçilen sağlayıcı için API anahtarı eksik." }, { status: 400 });
    }

    // Clean markdown code blocks if AI returns them
    generatedHtml = generatedHtml.replace(/```(?:html|HTML|xml|json)?/gi, "").replace(/```/g, "").trim();

    // Clean CJK characters if present (Qwen fallback safety)
    generatedHtml = generatedHtml.replace(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uff00-\uffef]/g, "").trim();

    // Generate a quick summary from the HTML
    const cleanText = generatedHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const summary = cleanText.length > 160 ? cleanText.substring(0, 157) + "..." : cleanText;

    return NextResponse.json({ 
        success: true, 
        content: generatedHtml,
        summary: summary
    });

  } catch (error: any) {
    console.error("AI Blog Generation Error:", error);
    return NextResponse.json({ error: "İşlem sırasında bir hata oluştu: " + error.message }, { status: 500 });
  }
}
