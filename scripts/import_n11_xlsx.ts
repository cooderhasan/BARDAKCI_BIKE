
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const prisma = new PrismaClient();

const filePath = 'emreserin_ÜrünGüncelle_11052026_122729.xlsx';

function slugify(text: string) {
    return text.toString().toLowerCase()
        .replace(/ /g, '-')
        .replace(/[ığüşöçİ]/g, (m) => ({ 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c', 'İ': 'i' }[m] || m))
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

async function main() {
    if (!fs.existsSync(filePath)) {
        console.error('File not found!');
        return;
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    console.log(`🚀 Toplam ${rows.length} ürün işleniyor...`);

    // 1. "Motosiklet Yedek Parça" kategorisini hazırla
    let mainCat = await prisma.category.findUnique({ where: { slug: 'motosiklet-yedek-parca' } });
    if (!mainCat) {
        console.log('📦 Motosiklet Yedek Parça kategorisi oluşturuluyor...');
        mainCat = await prisma.category.create({
            data: {
                name: 'Motosiklet Yedek Parça',
                slug: 'motosiklet-yedek-parca',
                isActive: true,
                isInHeader: true,
                isFeatured: true
            }
        });
    }

    let successCount = 0;
    let errorCount = 0;

    for (const row of rows) {
        try {
            const sku = String(row['Stok Kodu '] || '').trim();
            const barcode = String(row['Barcode'] || '').trim();
            const name = String(row['Ürün Adı '] || '').trim();
            const description = String(row['Ürün Açıklaması'] || '').trim();
            const brandName = String(row['Marka'] || 'Diğer').trim();
            const n11Price = Number(row['N11 Satış Fiyatı (KDV Dahil)']) || 0;
            const listPrice = Number(row['Piyasa Satış Fiyatı (KDV Dahil)']) || n11Price;
            const stock = Number(row['Stok']) || 0;
            const n11Id = String(row['Ürün Kodu '] || '').trim();
            
            // Extract images
            const images = [];
            for (let i = 1; i <= 8; i++) {
                const imgUrl = row[`Görsel ${i}`];
                if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
                    images.push(imgUrl);
                }
            }

            if (!name || !sku) {
                console.warn(`⚠️ Eksik bilgi: SKU: ${sku}, Ad: ${name}. Atlanıyor.`);
                continue;
            }

            // 2. Markayı bul veya oluştur (Büyük/Küçük harf duyarlılığını ortadan kaldır)
            const normalizedBrandName = brandName.trim();
            let brand = await prisma.brand.findFirst({ 
                where: { name: { equals: normalizedBrandName, mode: 'insensitive' } } 
            });

            if (!brand) {
                const baseSlug = slugify(normalizedBrandName);
                // Slug çakışması için kontrol
                let finalSlug = baseSlug;
                const existingSlug = await prisma.brand.findUnique({ where: { slug: baseSlug } });
                if (existingSlug) {
                    finalSlug = `${baseSlug}-${Math.floor(Math.random() * 1000)}`;
                }

                brand = await prisma.brand.create({
                    data: {
                        name: normalizedBrandName,
                        slug: finalSlug,
                        isActive: true
                    }
                });
            }

            // 3. Ürünü oluştur veya güncelle
            const productSlug = `${slugify(name)}-${sku.toLowerCase()}`;
            
            const product = await prisma.product.upsert({
                where: { sku: sku },
                update: {
                    name: name,
                    barcode: barcode,
                    brandId: brand.id,
                    description: description,
                    listPrice: listPrice,
                    salePrice: n11Price,
                    n11Price: n11Price,
                    stock: stock,
                    images: images,
                    isActive: true,
                    isN11Active: true,
                    categories: {
                        connect: { id: mainCat.id }
                    }
                },
                create: {
                    name: name,
                    slug: productSlug,
                    sku: sku,
                    barcode: barcode,
                    brandId: brand.id,
                    description: description,
                    listPrice: listPrice,
                    salePrice: n11Price,
                    n11Price: n11Price,
                    stock: stock,
                    images: images,
                    isActive: true,
                    isN11Active: true,
                    categories: {
                        connect: { id: mainCat.id }
                    }
                }
            });

            // 4. N11Product tablosunu güncelle
            await (prisma as any).n11Product.upsert({
                where: { productId: product.id },
                update: {
                    sellerCode: sku,
                    n11Id: n11Id,
                    isSynced: true,
                    lastSyncedAt: new Date()
                },
                create: {
                    productId: product.id,
                    sellerCode: sku,
                    n11Id: n11Id,
                    isSynced: true,
                    lastSyncedAt: new Date()
                }
            });

            successCount++;
            if (successCount % 50 === 0) {
                console.log(`✅ ${successCount} ürün tamamlandı...`);
            }

        } catch (err: any) {
            console.error(`❌ Hata (Row: ${row['Ürün Adı ']}):`, err.message);
            errorCount++;
        }
    }

    console.log(`\n🎉 İşlem Tamamlandı!`);
    console.log(`✅ Başarılı: ${successCount}`);
    console.log(`❌ Hatalı: ${errorCount}`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
