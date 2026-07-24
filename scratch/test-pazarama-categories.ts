import { prisma } from "../src/lib/db";
import { PazaramaClient } from "../src/services/pazarama/api";

async function main() {
  const config = await (prisma as any).pazaramaConfig.findFirst();
  console.log("Config from DB:", config);

  if (!config) {
    console.log("No Pazarama config found in DB!");
    return;
  }

  const client = new PazaramaClient(config);
  console.log("Testing connection...");
  const connTest = await client.testConnection();
  console.log("Connection test result:", connTest);

  console.log("Testing getCategories()...");
  const categories = await client.getCategories();
  console.log("Categories returned count:", categories.length);
  if (categories.length > 0) {
    console.log("First 3 categories sample:", JSON.stringify(categories.slice(0, 3), null, 2));
  } else {
    console.log("Categories returned empty!");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
