import { prisma } from "../src/lib/db";

async function main() {
  const settings = await prisma.siteSettings.findMany({});
  console.log("SiteSettings keys:", settings.map(s => s.key));
}

main().catch(console.error).finally(() => prisma.$disconnect());
