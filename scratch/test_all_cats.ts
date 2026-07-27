import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      ciceksepetiCategoryId: true,
      pazaramaCategoryId: true,
      hbCategoryId: true,
      n11CategoryId: true,
      trendyolCategoryId: true,
      _count: {
        select: { products: true },
      },
    },
  });

  console.log(`Total categories in DB: ${categories.length}`);
  console.log(JSON.stringify(categories, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
