import { prisma } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Admin'deki AI ayarıyla (Gemini AI sayfası: OpenRouter veya Gemini) HTML metin üretir.
 * Ürün açıklaması (api/admin/ai/generate-description) ve kategori açıklaması aynı fonksiyonu kullanır.
 * Çağıran yer yetki kontrolünü kendisi yapmalı.
 */
export async function generateAiHtml(systemPrompt: string, userPrompt: string, opts: { temperature?: number } = {}): Promise<string> {
    const temperature = opts.temperature ?? 1.0;
    const config = await prisma.geminiConfig.findFirst({ where: { isActive: true } });
    if (!config) throw new Error("Yapay Zeka (AI) yapılandırılmamış veya aktif değil.");

    let html = "";
    if (config.provider === "OPENROUTER" && config.openRouterApiKey) {
        // Veritabanındaki eski ':beta' takısı temizlenir
        const modelId = (config.openRouterModel || "openai/gpt-4o-mini").replace(":beta", "").trim();
        const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${config.openRouterApiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://bardakcibike.com.tr",
                "X-Title": "Bardakci Bike B2C",
            },
            body: JSON.stringify({
                model: modelId,
                temperature,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
            }),
        });
        const orData = await orRes.json();
        if (orData.error) throw new Error(`OpenRouter Hatası: ${orData.error.message || JSON.stringify(orData.error)}`);
        const message = orData.choices?.[0]?.message;
        if (message?.refusal) throw new Error(`Yapay Zeka Reddi: ${message.refusal}`);
        html = message?.content || "";
        if (!html) throw new Error("Yapay zeka herhangi bir içerik üretmedi. Lütfen modeli veya sağlayıcıyı değiştirip tekrar deneyin.");
    } else if (config.provider === "GEMINI" && config.apiKey) {
        const genAI = new GoogleGenerativeAI(config.apiKey);
        const modelId = config.openRouterModel?.split("/").pop()?.replace(":free", "") || "gemini-1.5-flash";
        const model = genAI.getGenerativeModel({ model: modelId, systemInstruction: systemPrompt });
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: { temperature },
        });
        html = (await result.response).text();
    } else {
        throw new Error("Seçilen sağlayıcı için API anahtarı eksik.");
    }

    return html
        // Model markdown kod bloğu döndürürse temizle
        .replace(/```(?:html|HTML|xml|json)?/gi, "")
        .replace(/```/g, "")
        // Qwen gibi modellerde araya karışan Çince/Japonca/Korece karakterler
        .replace(/[一-鿿぀-ゟ゠-ヿ＀-￯]/g, "")
        .trim();
}
