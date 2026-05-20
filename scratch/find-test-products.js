const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function findTestProducts() {
    try {
        // İsmi veya SKU'sunda "test" geçen veya son eklenen 10 ürünü getirelim
        const products = await prisma.product.findMany({
            where: {
                OR: [
                    { name: { contains: "test", mode: "insensitive" } },
                    { sku: { contains: "test", mode: "insensitive" } }
                ]
            },
            take: 10
        });
        
        console.log(`🔍 "test" kelimesi geçen ürünler (${products.length} adet):`);
        products.forEach(p => {
            console.log(`- ID: ${p.id}, Adı: ${p.name}, SKU: ${p.sku}`);
        });
        
        const latestProducts = await prisma.product.findMany({
            orderBy: { createdAt: "desc" },
            take: 5
        });
        console.log(`\n🔍 Son eklenen 5 ürün:`);
        latestProducts.forEach(p => {
            console.log(`- ID: ${p.id}, Adı: ${p.name}, SKU: ${p.sku}, Tarih: ${p.createdAt}`);
        });
        
    } catch (e) {
        console.error("Hata:", e);
    } finally {
        await prisma.$disconnect();
    }
}

findTestProducts();
