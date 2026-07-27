import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const allProducts = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          ciceksepetiCategoryId: true,
        },
      },
    },
  });

  const matching = allProducts.filter((p) =>
    p.name.toLowerCase().includes("rainbow") ||
    p.name.toLowerCase().includes("pedal") ||
    p.name.toLowerCase().includes("aliminyum") ||
    p.name.toLowerCase().includes("alüminyum")
  );

  console.log(`Found ${matching.length} matching products out of ${allProducts.length} total products:`);
  console.log(matching);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
