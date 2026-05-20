const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function analyzeProduct() {
    try {
        const productId = "cmp8lh0230000th0l59h40ny9";
        
        const product = await prisma.product.findUnique({
            where: { id: productId }
        });
        
        if (!product) {
            console.log("❌ Ürün veritabanında bulunamadı!");
            return;
        }
        
        console.log(`📦 Ürün Adı: ${product.name}`);
        console.log(`📦 SKU: ${product.sku}`);
        
        // Bu ürüne bağlı sipariş kalemlerini sorgula
        const orderItems = await prisma.orderItem.findMany({
            where: { productId: productId },
            include: { order: true }
        });
        
        console.log(`\n🧾 Bağlı Sipariş Kalemi Sayısı: ${orderItems.length}`);
        orderItems.forEach(item => {
            console.log(`   - Sipariş No: #${item.order?.orderNumber} (ID: ${item.orderId}), Miktar: ${item.quantity}`);
        });
        
        // Bu ürüne bağlı sepet kalemlerini sorgula
        const cartItems = await prisma.cartItem.findMany({
            where: { productId: productId }
        });
        console.log(`🛒 Bağlı Sepet Kalemi Sayısı: ${cartItems.length}`);
        
    } catch (e) {
        console.error("Hata:", e);
    } finally {
        await prisma.$disconnect();
    }
}

analyzeProduct();
