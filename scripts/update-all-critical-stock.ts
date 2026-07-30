import { prisma } from "../src/lib/db";

async function main() {
  console.log("🚀 Updating criticalStock for all products to 1...");

  const result = await prisma.product.updateMany({
    data: {
      criticalStock: 1
    }
  });

  console.log(`✅ Successfully updated ${result.count} products to criticalStock = 1!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
