import { prisma } from "../src/lib/db";

async function main() {
  const cats = await prisma.category.findMany({});
  console.log(`Total categories in DB: ${cats.length}`);
  
  const dis = cats.filter(c => c.slug.includes("dis") || c.name.includes("Dış") || c.slug.includes("motosiklet-d"));
  console.log("Filtered 'dis' categories:", dis);
}

main().catch(console.error).finally(() => prisma.$disconnect());
