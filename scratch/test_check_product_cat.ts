import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.category.findMany({
    where: {
      ciceksepetiCategoryId: { not: null },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      ciceksepetiCategoryId: true,
      parentId: true,
      products: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  console.log(`Found ${categories.length} categories with Ciceksepeti ID:`);
  for (const c of categories) {
    console.log({
      id: c.id,
      name: c.name,
      ciceksepetiCategoryId: c.ciceksepetiCategoryId,
      productCount: c.products.length,
      sampleProducts: c.products.slice(0, 3).map((p) => p.name),
    });
  }

  // Also check if any category name contains "Pedal" or "Bisiklet"
  const pedalCats = await prisma.category.findMany({
    where: {
      OR: [
        { name: { contains: "Pedal", mode: "insensitive" } },
        { name: { contains: "Bisiklet", mode: "insensitive" } },
      ],
    },
  });
  console.log("\nPedal/Bisiklet categories:");
  console.log(pedalCats.map((c) => ({ id: c.id, name: c.name, ciceksepetiCategoryId: c.ciceksepetiCategoryId })));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
