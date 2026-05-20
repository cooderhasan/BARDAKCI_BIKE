const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        console.log("📡 Kendi e-ticaret (WEB) siparişleri veritabanından sorgulanıyor...");
        
        // Son 15 WEB siparişini getir
        const orders = await prisma.order.findMany({
            where: {
                source: "WEB"
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 15,
            include: {
                user: true
            }
        });

        console.log(`📊 Toplam ${orders.length} adet WEB siparişi bulundu:\n`);

        orders.forEach(o => {
            const customerEmail = o.guestEmail || o.user?.email || "YOK";
            const name = o.shippingAddress?.name || o.shippingAddress?.fullName || o.user?.name || "Bilinmiyor";
            console.log(`----------------------------------------`);
            console.log(`📦 Sipariş No: #${o.orderNumber}`);
            console.log(`📅 Tarih: ${o.createdAt}`);
            console.log(`👤 Müşteri: ${name} (${customerEmail})`);
            console.log(`💰 Tutar: ${o.total} TL`);
            console.log(`⚡ Durum: ${o.status}`);
            console.log(`🧾 Fatura No: ${o.invoiceNo || "Fatura Kesilmemiş ❌"}`);
            console.log(`🔗 Fatura URL: ${o.invoiceUrl || "PDF Yok ❌"}`);
            console.log(`📝 Notlar: ${o.notes || "Not yok"}`);
        });

    } catch (error) {
        console.error("❌ Veritabanı sorgu hatası:", error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
