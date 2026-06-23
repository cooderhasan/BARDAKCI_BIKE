import { prisma } from "../src/lib/db";

async function main() {
  try {
    const sliders = await prisma.slider.findMany();
    console.log("SLIDERS IN DB:");
    console.dir(sliders, { depth: null });
  } catch (error) {
    console.error("DB Query Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
