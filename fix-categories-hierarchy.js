const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const categoriesData = [
  {
    name: "DAĞ BİSİKLETİ",
    subcategories: [
      "26 JANT ERKEK DAĞ BİSİKLETİ",
      "27.5 JANT ERKEK DAĞ BİSİKLETİ",
      "29 JANT ERKEK DAĞ BİSİKLETİ",
      "26 JANT KADIN DAĞ BİSİKLETİ",
      "24 JANT KADIN DAĞ BİSİKLETİ",
      "24 JANT ERKEK DAĞ BİSİKLETİ",
      "27.5 JANT KADIN DAĞ BİSİKLETİ",
      "27.5 JANT KADIN ŞEHİR BİSİKLETİ",
      "29 JANT KADIN DAĞ BİSİKLETİ"
    ]
  },
  {
    name: "ÇOCUK BİSİKLETİ",
    subcategories: [
      "20 JANT ERKEK ÇOCUK BİSİKLETİ",
      "16 JANT ERKEK ÇOCUK BİSİKLETİ",
      "16 JANT KIZ ÇOCUK BİSİKLETİ",
      "12 JANT ERKEK ÇOCUK BİSİKLETİ",
      "20 JANT KIZ ÇOCUK BİSİKLETİ",
      "14 JANT ERKEK ÇOCUK BİSİKLETİ",
      "14 JANT KIZ ÇOCUK BİSİKLETİ",
      "12 JANT KIZ ÇOCUK BİSİKLETİ"
    ]
  },
  {
    name: "KATLANABİLİR BİSİKLET",
    subcategories: [
      "20 JANT ERKEK KATLANABİLİR BİSİKLET",
      "24 JANT KATLANABİLİR BİSİKLET",
      "26 JANT ERKEK KATLANIR BİSİKLET"
    ]
  },
  {
    name: "YOL YARIŞ BİSİKLETİ",
    subcategories: [
      "28 JANT ERKEK KARBON YOL YARIŞ BİSİKLETİ",
      "29 JANT ERKEK ALÜMİNYUM YOL YARIŞ BİSİKLETİ",
      "28 JANT ERKEK GRAVEL YOL YARIŞ BİSİKLETİ",
      "27.5 JANT ERKEK GRAVEL YOL YARIŞ BİSİKLETİ",
      "28 JANT ERKEK ALÜMİNYUM YOL YARIŞ BİSİKLETİ"
    ]
  },
  {
    name: "ŞEHİR BİSİKLETİ",
    subcategories: [
      "28 JANT KADIN ŞEHİR BİSİKLETİ",
      "28 JANT ERKEK ŞEHİR BİSİKLETİ",
      "24 JANT KADIN ŞEHİR BİSİKLETİ",
      "26 JANT KADIN ŞEHİR BİSİKLETİ",
      "24 JANT KARAVAN ŞEHİR BİSİKLETİ",
      "27.5 JANT ERKEK ŞEHİR BİSİKLETİ",
      "24 JANT ERKEK ŞEHİR BİSİKLETİ",
      "27.5 JANT KADIN ŞEHİR BİSİKLETİ",
      "26 JANT ERKEK ŞEHİR BİSİKLETİ"
    ]
  },
  {
    name: "ELEKTRİKLİ BİSİKLET",
    subcategories: [
      "20 JANT ERKEK ELEKTRİKLİ BİSİKLET",
      "26 JANT ERKEK ELEKTRİKLİ BİSİKLET",
      "28 JANT KADIN ELEKTRİKLİ BİSİKLET",
      "24 JANT ELEKTRİKLİ KARAVAN BİSİKLET",
      "27.5 JANT KADIN ELEKTRİKLİ BİSİKLET",
      "27.5 JANT ERKEK ELEKTRİKLİ BİSİKLET",
      "29 JANT ERKEK ELEKTRİKLİ BİSİKLET",
      "28 JANT ELEKTRİKLİ KADIN ŞEHİR BİSİKLETİ",
      "24 JANT ERKEK ELEKTRİKLİ BİSİKLET",
      "28 JANT ERKEK ELEKTRİKLİ BİSİKLET"
    ]
  }
];

async function main() {
    console.log("=== CHECKING AND FIXING CATEGORY HIERARCHY ===");

    for (const group of categoriesData) {
        // Find parent category in DB
        const parent = await prisma.category.findFirst({
            where: {
                name: { equals: group.name, mode: 'insensitive' }
            }
        });

        if (!parent) {
            console.log(`⚠️ Parent category "${group.name}" NOT found in DB. Skipping its subcategories.`);
            continue;
        }

        console.log(`\nParent: "${parent.name}" (ID: ${parent.id})`);

        for (const subName of group.subcategories) {
            const sub = await prisma.category.findFirst({
                where: {
                    name: { equals: subName, mode: 'insensitive' }
                }
            });

            if (!sub) {
                console.log(`  - Subcategory "${subName}" NOT found in DB.`);
                continue;
            }

            if (sub.parentId !== parent.id) {
                console.log(`  - Fixing parent for "${sub.name}": "${sub.parentId || 'NONE'}" -> "${parent.name}" (${parent.id})`);
                await prisma.category.update({
                    where: { id: sub.id },
                    data: { parentId: parent.id }
                });
            } else {
                console.log(`  - OK: "${sub.name}" is already a child of "${parent.name}".`);
            }
        }
    }
    console.log("\n=== HIERARCHY CHECK AND FIX COMPLETE ===");
}

main().finally(() => prisma.$disconnect());
