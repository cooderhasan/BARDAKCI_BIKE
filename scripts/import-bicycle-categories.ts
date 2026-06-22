import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

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
  console.log("🚀 Bisiklet kategorileri aktarımı başlatılıyor...");

  let mainCreated = 0;
  let subCreated = 0;

  for (const group of categoriesData) {
    const parentSlug = slugify(group.name);

    // Ana kategoriyi oluştur/güncelle
    const parentCategory = await prisma.category.upsert({
      where: { slug: parentSlug },
      update: { isInHeader: true, isFeatured: true },
      create: {
        name: group.name,
        slug: parentSlug,
        isInHeader: true,
        isFeatured: true,
      },
    });

    mainCreated++;
    console.log(`\n📂 Ana kategori: ${parentCategory.name} (${parentSlug})`);

    // Alt kategorileri oluştur/güncelle
    for (const subName of group.subcategories) {
      const subSlug = slugify(subName);

      await prisma.category.upsert({
        where: { slug: subSlug },
        update: { parentId: parentCategory.id },
        create: {
          name: subName,
          slug: subSlug,
          parentId: parentCategory.id,
        },
      });

      subCreated++;
      console.log(`   └─ Alt kategori: ${subName} (${subSlug})`);
    }
  }

  console.log(`\n🎉 Aktarım tamamlandı! ${mainCreated} ana kategori ve ${subCreated} alt kategori güncellendi/eklendi.`);
}

main()
  .catch((e) => {
    console.error("❌ Hata oluştu:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
