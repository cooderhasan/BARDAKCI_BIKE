import { prisma } from "./src/lib/db";

export function cleanSlug(text: string): string {
    if (!text) return "";

    const turkishChars: Record<string, string> = {
        'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
        'Ç': 'c', 'Ğ': 'g', 'I': 'i', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u',
    };

    return text
        .normalize('NFD') // Decompose characters (e.g., i + dot)
        .replace(/[\u0300-\u036f]/g, "") // Remove all combining marks (the hidden dots)
        .replace(/[çğıöşüÇĞIİÖŞÜ]/g, (char) => turkishChars[char] || char)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

async function fixSlugs() {
    console.log("Ürün linkleri (slug) taranıyor ve düzeltiliyor...");
    
    const products = await prisma.product.findMany({
        select: {
            id: true,
            name: true,
            slug: true
        }
    });

    let fixedCount = 0;

    for (const product of products) {
        const cleaned = cleanSlug(product.slug);
        
        // If the cleaned slug is different or still contains weird characters
        if (cleaned !== product.slug) {
            try {
                await prisma.product.update({
                    where: { id: product.id },
                    data: { slug: cleaned }
                });
                console.log(`Düzenlendi: ${product.slug} -> ${cleaned}`);
                fixedCount++;
            } catch (error) {
                console.error(`Hata (${product.slug}): Link çakışması olabilir.`, error);
            }
        }
    }

    console.log(`İşlem tamamlandı. ${fixedCount} ürün linki düzeltildi.`);
}

fixSlugs()
    .catch(console.error)
    .finally(() => process.exit());
