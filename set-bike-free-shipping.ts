import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Bisiklet kategorilerindeki ürünlere toplu isFreeShipping=true atar.
 * 
 * Bisiklet Ana Kategorileri:
 * - DAĞ BİSİKLETİ
 * - ÇOCUK BİSİKLETİ
 * - KATLANABİLİR BİSİKLET
 * - YOL YARIŞ BİSİKLETİ
 * - ŞEHİR BİSİKLETİ
 * - ELEKTRİKLİ BİSİKLET
 */
async function main() {
    // 1. Bisiklet ana kategori ID'lerini bul
    const bikeRootCategories = await prisma.category.findMany({
        where: {
            name: {
                in: [
                    'DAĞ BİSİKLETİ',
                    'ÇOCUK BİSİKLETİ',
                    'KATLANABİLİR BİSİKLET',
                    'YOL YARIŞ BİSİKLETİ',
                    'ŞEHİR BİSİKLETİ',
                    'ELEKTRİKLİ BİSİKLET',
                ]
            }
        },
        select: { id: true, name: true }
    });

    console.log(`Bulunan bisiklet ana kategorileri: ${bikeRootCategories.length}`);
    bikeRootCategories.forEach(c => console.log(`  - ${c.name} (${c.id})`));

    // 2. Alt kategorileri de bul (recursive)
    const allBikeCategoryIds: string[] = bikeRootCategories.map(c => c.id);
    
    async function findChildCategories(parentIds: string[]) {
        const children = await prisma.category.findMany({
            where: { parentId: { in: parentIds } },
            select: { id: true, name: true }
        });
        if (children.length > 0) {
            const childIds = children.map(c => c.id);
            allBikeCategoryIds.push(...childIds);
            children.forEach(c => console.log(`    Alt kategori: ${c.name} (${c.id})`));
            await findChildCategories(childIds);
        }
    }

    await findChildCategories(allBikeCategoryIds);
    console.log(`\nToplam bisiklet kategori sayısı (alt dahil): ${allBikeCategoryIds.length}`);

    // 3. Bu kategorilere bağlı ürünleri bul (categories many-to-many + legacy categoryId)
    const productsInBikeCategories = await prisma.product.findMany({
        where: {
            OR: [
                { categories: { some: { id: { in: allBikeCategoryIds } } } },
                { categoryId: { in: allBikeCategoryIds } },
            ]
        },
        select: { id: true, name: true, isFreeShipping: true }
    });

    console.log(`\nBisiklet kategorilerindeki ürün sayısı: ${productsInBikeCategories.length}`);

    // 4. Toplu güncelleme
    if (productsInBikeCategories.length > 0) {
        const productIds = productsInBikeCategories.map(p => p.id);
        const result = await prisma.product.updateMany({
            where: { id: { in: productIds } },
            data: { isFreeShipping: true }
        });
        console.log(`\n✅ ${result.count} ürün isFreeShipping=true olarak güncellendi.`);
    } else {
        console.log('\n⚠️ Bisiklet kategorisinde ürün bulunamadı.');
    }

    // 5. Kontrol: Kaç ürün isFreeShipping=true oldu
    const freeShippingCount = await prisma.product.count({
        where: { isFreeShipping: true }
    });
    const totalCount = await prisma.product.count();
    console.log(`\nSonuç: ${freeShippingCount}/${totalCount} ürün ücretsiz kargo.`);
}

main()
    .catch(e => {
        console.error('Hata:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
