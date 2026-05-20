const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        console.log("📡 Ürün görsel verileri sorgulanıyor...");
        
        const products = await prisma.product.findMany({
            where: {
                images: {
                    isEmpty: false
                }
            },
            take: 5,
            select: {
                id: true,
                name: true,
                images: true
            }
        });

        console.log(`📊 Görseli olan ${products.length} adet ürün inceleniyor:\n`);

        products.forEach(p => {
            console.log(`📦 Ürün: ${p.name}`);
            console.log(`🖼️ Görseller:`, JSON.stringify(p.images, null, 2));
        });

    } catch (error) {
        console.error("❌ Hata:", error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
