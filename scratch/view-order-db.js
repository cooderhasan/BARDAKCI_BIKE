const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkOrder() {
    try {
        const orderNumber = "4178899073";
        const order = await prisma.order.findFirst({
            where: { orderNumber: orderNumber }
        });
        
        if (!order) {
            console.log(`❌ Sipariş bulunamadı: ${orderNumber}`);
            
            // Tüm Hepsiburada siparişlerini listele
            const hbOrders = await prisma.order.findMany({
                where: { source: "HEPSIBURADA" },
                take: 5
            });
            console.log("Mevcut Hepsiburada siparişleri sayısı:", hbOrders.length);
            hbOrders.forEach(o => {
                console.log(`- #${o.orderNumber}: Source=${o.source}, InvoiceNo=${o.invoiceNo}, InvoiceUrl=${o.invoiceUrl}`);
            });
            return;
        }
        
        console.log("✅ Bulunan Sipariş Detayları:");
        console.log(`- ID: ${order.id}`);
        console.log(`- Sipariş Numarası: ${order.orderNumber}`);
        console.log(`- Kaynak (Source): ${order.source}`);
        console.log(`- Fatura No: ${order.invoiceNo}`);
        console.log(`- Fatura URL: ${order.invoiceUrl}`);
        console.log(`- Status: ${order.status}`);
    } catch (e) {
        console.error("Hata:", e);
    } finally {
        await prisma.$disconnect();
    }
}

checkOrder();
