import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      name: {
        contains: "Rainbow",
        mode: "insensitive",
      },
    },
    include: {
      category: true,
      categories: true,
    },
  });

  console.log("Rainbow Products Count:", products.length);
  for (const p of products) {
    console.log({
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      categoryName: p.category?.name,
      categoryCiceksepetiId: p.category?.ciceksepetiCategoryId,
      categories: p.categories.map((c) => ({ id: c.id, name: c.name, csId: c.ciceksepetiCategoryId })),
    });
  }

  // Also check products with name containing "Pedal Takımı"
  const pedalProducts = await prisma.product.findMany({
    where: {
      name: {
        contains: "Pedal Takımı",
        mode: "insensitive",
      },
    },
    include: {
      category: true,
      categories: true,
    },
  });

  console.log("\nPedal Takımı Products Count:", pedalProducts.length);
  for (const p of pedalProducts) {
    console.log({
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      categoryName: p.category?.name,
      categoryCiceksepetiId: p.category?.ciceksepetiCategoryId,
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
