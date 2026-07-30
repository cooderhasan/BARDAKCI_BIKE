import { prisma } from "../src/lib/db";

async function main() {
  console.log("🚀 Starting Tire Categories Migration...");

  // 1. Parent category: "Motosiklet Yedek Parça" (or null)
  const mainParent = await prisma.category.findFirst({
    where: { slug: "motosiklet-yedek-parca-1" }
  }) || await prisma.category.findFirst({
    where: { slug: "motosiklet-yedek-parca" }
  });

  const parentId = mainParent?.id || null;

  // 2. Ensure Target Category 1: "Motosiklet Dış Lastikler" (slug: "motosiklet-dis-lastikler")
  let targetDis = await prisma.category.findFirst({
    where: {
      OR: [
        { slug: "motosiklet-dis-lastikler" },
        { name: "Motosiklet Dış Lastikler" }
      ]
    }
  });

  if (!targetDis) {
    console.log("Creating target category: Motosiklet Dış Lastikler...");
    targetDis = await prisma.category.create({
      data: {
        name: "Motosiklet Dış Lastikler",
        slug: "motosiklet-dis-lastikler",
        store: "MOTOR",
        parentId: parentId,
        isActive: true,
      }
    });
  } else {
    // Ensure parentId is correct
    if (parentId && targetDis.parentId !== parentId) {
      await prisma.category.update({
        where: { id: targetDis.id },
        data: { parentId: parentId }
      });
    }
  }
  console.log(`✅ Target Dış Lastik Category ID: ${targetDis.id} ("${targetDis.name}")`);

  // 3. Ensure Target Category 2: "Motosiklet İç Lastikler" (slug: "motosiklet-i-c-lastikler")
  let targetIc = await prisma.category.findFirst({
    where: {
      OR: [
        { slug: "motosiklet-i-c-lastikler" },
        { slug: "motosiklet-ic-lastikler" },
        { name: "Motosiklet İç Lastikler" }
      ]
    }
  });

  if (!targetIc) {
    console.log("Creating target category: Motosiklet İç Lastikler...");
    targetIc = await prisma.category.create({
      data: {
        name: "Motosiklet İç Lastikler",
        slug: "motosiklet-i-c-lastikler",
        store: "MOTOR",
        parentId: parentId,
        isActive: true,
      }
    });
  } else {
    // Ensure parentId is correct
    if (parentId && targetIc.parentId !== parentId) {
      await prisma.category.update({
        where: { id: targetIc.id },
        data: { parentId: parentId }
      });
    }
  }
  console.log(`✅ Target İç Lastik Category ID: ${targetIc.id} ("${targetIc.name}")`);

  // 4. Source categories to migrate to "Motosiklet Dış Lastikler"
  // Slugs: "lastik" (108 products), "lastik-1" (3 products)
  const sourceDisCats = await prisma.category.findMany({
    where: {
      slug: { in: ["lastik", "lastik-1"] }
    }
  });

  const sourceDisIds = sourceDisCats.map(c => c.id).filter(id => id !== targetDis!.id);

  if (sourceDisIds.length > 0) {
    console.log(`\n📦 Moving products from [${sourceDisCats.map(c => c.name + ' (' + c.slug + ')').join(', ')}] to Motosiklet Dış Lastikler...`);

    // Update legacy categoryId
    const updatedLegacyDis = await prisma.product.updateMany({
      where: { categoryId: { in: sourceDisIds } },
      data: { categoryId: targetDis.id }
    });
    console.log(`  - Updated legacy categoryId for ${updatedLegacyDis.count} products.`);

    // Update many-to-many relation table
    for (const sourceId of sourceDisIds) {
      await prisma.$executeRawUnsafe(
        `UPDATE "_CategoryToProduct" SET "A" = $1 WHERE "A" = $2 AND "B" NOT IN (SELECT "B" FROM "_CategoryToProduct" WHERE "A" = $1)`,
        targetDis.id,
        sourceId
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM "_CategoryToProduct" WHERE "A" = $1`,
        sourceId
      );
    }
  }

  // 5. Source categories to migrate to "Motosiklet İç Lastikler"
  // Slug: "ic-lastik" (13 products)
  const sourceIcCats = await prisma.category.findMany({
    where: {
      slug: { in: ["ic-lastik"] }
    }
  });

  const sourceIcIds = sourceIcCats.map(c => c.id).filter(id => id !== targetIc!.id);

  if (sourceIcIds.length > 0) {
    console.log(`\n📦 Moving products from [${sourceIcCats.map(c => c.name + ' (' + c.slug + ')').join(', ')}] to Motosiklet İç Lastikler...`);

    // Update legacy categoryId
    const updatedLegacyIc = await prisma.product.updateMany({
      where: { categoryId: { in: sourceIcIds } },
      data: { categoryId: targetIc.id }
    });
    console.log(`  - Updated legacy categoryId for ${updatedLegacyIc.count} products.`);

    // Update many-to-many relation table
    for (const sourceId of sourceIcIds) {
      await prisma.$executeRawUnsafe(
        `UPDATE "_CategoryToProduct" SET "A" = $1 WHERE "A" = $2 AND "B" NOT IN (SELECT "B" FROM "_CategoryToProduct" WHERE "A" = $1)`,
        targetIc.id,
        sourceId
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM "_CategoryToProduct" WHERE "A" = $1`,
        sourceId
      );
    }
  }

  // 6. Delete empty duplicate source categories
  const allDeleteIds = [...sourceDisIds, ...sourceIcIds];
  if (allDeleteIds.length > 0) {
    console.log(`\n🗑️ Deleting empty duplicate categories: ${allDeleteIds.join(', ')}...`);
    await prisma.category.deleteMany({
      where: { id: { in: allDeleteIds } }
    });
    console.log("  - Deleted duplicate categories successfully.");
  }

  // 7. Verify final counts
  const finalDisCount = await prisma.product.count({
    where: {
      OR: [
        { categoryId: targetDis.id },
        { categories: { some: { id: targetDis.id } } }
      ]
    }
  });

  const finalIcCount = await prisma.product.count({
    where: {
      OR: [
        { categoryId: targetIc.id },
        { categories: { some: { id: targetIc.id } } }
      ]
    }
  });

  console.log(`\n🎉 Migration Complete!`);
  console.log(`  - "Motosiklet Dış Lastikler" product count: ${finalDisCount}`);
  console.log(`  - "Motosiklet İç Lastikler" product count: ${finalIcCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
