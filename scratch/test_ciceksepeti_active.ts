import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const activeProducts = await prisma.product.findMany({
    where: { isCiceksepetiActive: true },
    select: {
      id: true,
      name: true,
      categoryId: true,
      category: {
        select: { id: true, name: true, ciceksepetiCategoryId: true },
      },
    },
  });

  console.log("Active Ciceksepeti Products Count:", activeProducts.length);
  for (const p of activeProducts) {
    console.log({
      id: p.id,
      name: p.name,
      categoryName: p.category?.name,
      ciceksepetiCategoryId: p.category?.ciceksepetiCategoryId,
    });
  }

  // Check all categories with product counts > 0
  const categoriesWithProducts = await prisma.category.findMany({
    where: {
      products: { some: {} },
    },
    select: {
      id: true,
      name: true,
      ciceksepetiCategoryId: true,
      _count: { select: { products: true } },
    },
  });

  console.log("\nCategories with products:");
  for (const c of categoriesWithProducts) {
    console.log({
      id: c.id,
      name: c.name,
      productCount: c._count.products,
      ciceksepetiCategoryId: c.ciceksepetiCategoryId,
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
