const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const count = await prisma.hepsiburadaCategory.count();
    console.log('Total HB Categories in DB:', count);
    
    // Check if we have "Grenaj" or "Alt Sakal"
    const grenajCats = await prisma.hepsiburadaCategory.findMany({
        where: { name: { contains: 'Grenaj', mode: 'insensitive' } },
        take: 10
    });
    console.log('Grenaj Categories Found:', JSON.stringify(grenajCats, null, 2));
}

main().finally(() => prisma.$disconnect());
