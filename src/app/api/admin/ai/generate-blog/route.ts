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

    // 2. Fetch real active categories from DB to prevent hallucinated 404 links
    const categories = await prisma.category.findMany({
        where: { isActive: true },
        select: { name: true, slug: true },
        orderBy: { order: "asc" },
        take: 40,
    });

    const categoryListText = categories.length > 0
        ? categories.map(c => `- ${c.name}: /category/${c.slug}`).join("\n")
        : `- Dağ Bisikleti: /category/dag-bisikleti\n- Şehir Bisikleti: /category/sehir-bisikleti\n- Çocuk Bisikleti: /category/cocuk-bisikleti\n- Bisiklet Aksesuar: /category/bisiklet-aksesuar\n- Bisiklet Yedek Parça: /category/bisiklet-yedek-parca\n- Tüm Ürünler: /products`;

    const systemPrompt = `Sen profesyonel bir bisiklet kültürü yazarı, bisiklet mekanisyeni ve e-ticaret SEO içerik uzmanısın.
    Görevin; verilen başlığa uygun olarak, hem okuyucuyu bilgilendirecek, hem de arama motorlarında üst sıralara çıkacak SEO uyumlu, profesyonel, akıcı ve bilgilendirici bir Türkçe blog yazısı yazmaktır.

    NİHAİ YAZIM VE FORMAT KURALLARI:
    1. YAPI (STRUCTURE): 
       - Başlangıçta konunun önemini anlatan ve okuyucunun ilgisini çeken kısa ve vurucu bir giriş paragrafı.
       - Ardından hiyerarşik alt başlıklar (<h2>, <h3> kullanarak) altında konuyu derinlemesine ele alan paragraflar.
       - Önemli listelemeler ve maddeler için mutlaka <ul> ve <li> etiketlerini kullan.
       - Karşılaştırma, teknik özellik veya puanlama içeren bölümlerde MUTLAKA standart HTML tablo etiketleri (<table><thead><tr><th>...</th></tr></thead><tbody><tr><td>...</td></tr></tbody></table>) kullan. Kesinlikle markdown (|...|) formatında tablo yapma, doğrudan saf HTML <table> etiketleri kullan.
       - Okuyucuya faydalı pratik ipuçları veya uyarılar için MUTLAKA <blockquote> etiketini kullan (örneğin: <blockquote>💡 <strong>Pratik İpucu:</strong> İpucu açıklaması buraya...</blockquote>). Kesinlikle div kullanma, blockquote kullan.
       - Sonuç bölümünde yazıyı özetle ve okuyucuyu dükkanımızda (Bardakcı Bisiklet) satılan ilgili ürün gruplarını incelemeye yönlendir.
    2. LİNKLER VE YÖNLENDİRMELER (KRİTİK KURAL):
       - Kesinlikle rastgele veya uydurma URL linki ekleme (örneğin '/kategori/...' veya '/urunler/...' gibi geçersiz linkler 404 hatası verir).
       - Sitedeki bağlantılar İngilizce 'category' şeklindedir (Örn: /category/dag-bisikleti).
       - Eğer yazı içinde veya sonunda link vereceksen SADECE şu gerçek mağaza linklerinden uygun olanı veya '/products' linkini kullan:
${categoryListText}
       - Örnek doğru link kullanımı: <a href="/category/bisiklet-yedek-parca">Bisiklet Yedek Parça Kategorisi</a> veya <a href="/products">Tüm Bisiklet Ürünlerimizi İnceleyin</a>
    3. VURGULAMA (BOLD): Önemli anahtar kelimeleri ve teknik terimleri <b>...</b> veya <strong>...</strong> etiketleri içinde vurgula.
    4. ÜSLUP: Samimi ama son derece bilgili, profesyonel, anlaşılır ve akıcı bir Türkçe kullan.
    5. UZUNLUK: Yazı en az 600-800 kelime uzunluğunda, detaylı ve doyurucu olmalıdır.
    6. HTML BİÇİMİ: Çıktıyı doğrudan HTML formatında ver. Ekstra markdown işaretlemeleri (\`\`\`html vb.) kullanma.`;

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

    // Helper: Convert any leftover markdown tables to clean HTML tables
    const tableRegex = /\|[^\n]+\|\n\|[\s-:|]+\|\n(?:\|[^\n]+\|\n?)+/g;
    generatedHtml = generatedHtml.replace(tableRegex, (match) => {
        const lines = match.trim().split("\n").map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) return match;

        const headers = lines[0].split("|").map(s => s.trim()).filter(Boolean);
        const rows = lines.slice(2);

        let html = '<table><thead><tr>';
        headers.forEach(h => {
            html += `<th>${h}</th>`;
        });
        html += '</tr></thead><tbody>';

        rows.forEach((row) => {
            const cells = row.split("|").map(s => s.trim()).filter(Boolean);
            html += '<tr>';
            cells.forEach(c => {
                html += `<td>${c}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    });

    // Helper: Convert any div-based callouts/boxes or tips to standard blockquotes so Tiptap never strips them
    generatedHtml = generatedHtml.replace(/<div[^>]*class=["'][^"']*(?:bg-blue|rounded|border)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi, '<blockquote>$1</blockquote>');

    // Helper: Auto-correct common link mistakes (e.g. /kategori/ -> /category/)
    generatedHtml = generatedHtml.replace(/href=["']\/kategori\//gi, 'href="/category/');
    generatedHtml = generatedHtml.replace(/href=["'](https?:\/\/[^\/]+)\/kategori\//gi, 'href="$1/category/');

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
