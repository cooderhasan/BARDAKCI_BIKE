import { prisma } from '../src/lib/db';

async function main() {
    try {
        const cat = await prisma.category.update({
            where: { slug: 'grenaj-aksami' },
            data: { hbCategoryId: '80405008' }
        });
        console.log('✅ Başarıyla güncellendi:', cat.name, '-> HB ID:', cat.hbCategoryId);
    } catch (error: any) {
        console.error('❌ Hata:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
