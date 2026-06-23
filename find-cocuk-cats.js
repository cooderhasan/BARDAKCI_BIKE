const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("=== ALL CATEGORIES ===");
    const categories = await prisma.category.findMany({
        include: {
            parent: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    for (const cat of categories) {
        console.log(`ID: ${cat.id} | Name: "${cat.name}" | Slug: "${cat.slug}" | Parent: "${cat.parent ? cat.parent.name : 'NONE'}" (ID: ${cat.parentId})`);
    }
}

main().finally(() => prisma.$disconnect());
