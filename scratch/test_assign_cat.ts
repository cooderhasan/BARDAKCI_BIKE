import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Let's set ciceksepetiCategoryId: "14604" for 'Bisiklet Aksesuarı' category
  const updated = await prisma.category.updateMany({
    where: {
      name: { contains: "Bisiklet", mode: "insensitive" },
    },
    data: {
      ciceksepetiCategoryId: "14604",
    },
  });

  console.log(`Updated ${updated.count} categories with Ciceksepeti ID 14604.`);

  const cat = await prisma.category.findFirst({
    where: { name: { contains: "Bisiklet", mode: "insensitive" } },
  });
  console.log("Updated category:", cat);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
