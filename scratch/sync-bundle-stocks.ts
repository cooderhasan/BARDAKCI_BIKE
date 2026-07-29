import { prisma } from "../src/lib/db";

async function main() {
  console.log("=== SYNCING BUNDLE PRODUCT STOCKS IN DB ===");
  const bundleProducts = await prisma.product.findMany({
    where: { isBundle: true },
    include: {
      bundleItems: {
        include: {
          childProduct: true,
        },
      },
    },
  });

  console.log(`Found ${bundleProducts.length} bundle products.`);

  for (const p of bundleProducts) {
    if (p.bundleItems.length === 0) continue;

    let minStock = Infinity;
    for (const bi of p.bundleItems) {
      const cpStock = bi.childProduct?.stock || 0;
      const avail = Math.floor(cpStock / (bi.quantity || 1));
      if (avail < minStock) minStock = avail;
    }
    const finalStock = minStock === Infinity ? 0 : Math.max(0, minStock);

    console.log(
      `Product [${p.sku || p.id}] "${p.name}": Old Stock=${p.stock} -> New Stock=${finalStock}`
    );

    await prisma.product.update({
      where: { id: p.id },
      data: { stock: finalStock },
    });
  }

  console.log("=== BUNDLE STOCK SYNC FINISHED ===");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
