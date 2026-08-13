import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Kategori aktarımı başlatılıyor...");

  const mainCategoryName = "Motosiklet Yedek Parça";
  const subCategories = [
    "Akü", "Buji", "Egzoz", "Gates Kayış", "Jant", 
    "Koruma Demiri", "Mekanik Parça", "Sinyal Grubu",
    "Ayna", "Cam", "Far Grubu", "Grenaj Aksamı", 
    "Kaporta Setleri", "Kumanda ve Tel", "Motosiklet Motoru", 
    "Stop Lamba Grubu", "Benzin Deposu", "Debriyaj Balatası", 
    "Fren Aksamı", "Hava Filtreleri", "Kilometre Saati", 
    "Lastik", "Motosiklet Zincirleri"
  ];

  // 1. Ana kategori: Motosiklet Yedek Parça (1. Kategori)
  const mainCategory = await prisma.category.upsert({
    where: { slug: "motosiklet-yedek-parca" },
    update: { isInHeader: true, headerOrder: 1, isFeatured: true },
    create: {
      name: mainCategoryName,
      slug: "motosiklet-yedek-parca",
      isInHeader: true,
      headerOrder: 1,
      isFeatured: true,
    },
  });

  console.log(`✅ Ana kategori hazır: ${mainCategory.name}`);

  // 2. İkinci Ana Kategori: Markaya Göre (2. Kategori)
  const brandCategoryName = "Markaya Göre";
  const brandSubCategories = [
    "Mondial", "Bajaj", "Cf Moto", "Kanuni", "RKS", "TVS", 
    "Honda", "Arora", "Chopper", "KTM", "Suzuki", "Yamaha", 
    "Atv", "Hero", "Kuba", "SYM Motor"
  ];

  const brandCategory = await prisma.category.upsert({
    where: { slug: "markaya-gore" },
    update: { isInHeader: true, headerOrder: 2, isFeatured: true },
    create: {
      name: brandCategoryName,
      slug: "markaya-gore",
      isInHeader: true,
      headerOrder: 2,
      isFeatured: true,
    },
  });

  console.log(`✅ İkinci ana kategori hazır: ${brandCategory.name}`);

  // 3. Üçüncü Ana Kategori: Motosiklet Aksesuar (3. Kategori)
  const accessoryCategoryName = "Motosiklet Aksesuar";
  const accessorySubCategories = [
    "Aksiyon Kamera ve Aparatları", "Çanta", "Kilit Sistemi", 
    "Motosiklet Moto Play", "Telefon Tutucu", "Alarm Sistemi", 
    "Elcik Koruma", "Led", "Motosiklet Takip Cihazları", 
    "Anahtarlık", "Intercom & Bluetooth", "Motosiklet Kamp Ürünleri", 
    "Tank Pad & Sticker"
  ];

  const accessoryCategory = await prisma.category.upsert({
    where: { slug: "motosiklet-aksesuar" },
    update: { isInHeader: true, headerOrder: 3, isFeatured: true },
    create: {
      name: accessoryCategoryName,
      slug: "motosiklet-aksesuar",
      isInHeader: true,
      headerOrder: 3,
      isFeatured: true,
    },
  });

  console.log(`✅ Üçüncü ana kategori hazır: ${accessoryCategory.name}`);

  // 4. Dördüncü Ana Kategori: Bakım ve Tamir Ürünleri (4. Kategori)
  const maintenanceCategoryName = "Bakım ve Tamir Ürünleri";
  const maintenanceSubCategories = [
    "Amortisör Yağı", "Fren Hidrolik Yağı", "Motul Bakım Ürünleri", 
    "Temizlik Ürünleri", "Antifriz", "Hiflo Filtre", "Tamir Seti", 
    "Yağ", "Branda & Örtü", "K&N Yağ Filtreleri", "Tamirat Ürünleri", 
    "Zincir Temizleme Ürünleri"
  ];

  const maintenanceCategory = await prisma.category.upsert({
    where: { slug: "bakim-ve-tamir-urunleri" },
    update: { isInHeader: true, headerOrder: 4, isFeatured: true },
    create: {
      name: maintenanceCategoryName,
      slug: "bakim-ve-tamir-urunleri",
      isInHeader: true,
      headerOrder: 4,
      isFeatured: true,
    },
  });

  console.log(`✅ Dördüncü ana kategori hazır: ${maintenanceCategory.name}`);

  // 5. Beşinci Ana Kategori: Motosiklet Koruma Ekipmanları (Diğer kategoriler)
  const protectionCategoryName = "Motosiklet Koruma Ekipmanları";
  const protectionSubCategories = [
    "Bot", "Gözlük", "Mont", "Yağmurluk", "Boyunluk & Maske", 
    "Kask", "Pantolon", "Yelekler & Termal Giyim", "Eldiven", 
    "Korumalar", "T-shirt"
  ];

  const protectionCategory = await prisma.category.upsert({
    where: { slug: "motosiklet-koruma-ekipmanlari" },
    update: { isInHeader: false, isFeatured: true },
    create: {
      name: protectionCategoryName,
      slug: "motosiklet-koruma-ekipmanlari",
      isInHeader: false,
      isFeatured: true,
    },
  });

  console.log(`✅ Beşinci ana kategori hazır: ${protectionCategory.name}`);

  // 6. Alt kategorileri ekle (Tüm gruplar için)
  async function addSubs(subs: string[], parentId: string) {
    let subCount = 0;
    for (const subName of subs) {
      const slug = subName.toLowerCase()
        .replace(/ /g, "-")
        .replace(/[ığüşöç&]/g, (m) => ({ 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c', '&': 've' }[m] || m));

      await prisma.category.upsert({
        where: { slug: slug },
        update: { parentId: parentId },
        create: {
          name: subName,
          slug: slug,
          parentId: parentId,
        },
      });
      subCount++;
    }
    return subCount;
  }

  const count1 = await addSubs(subCategories, mainCategory.id);
  const count2 = await addSubs(protectionSubCategories, protectionCategory.id);
  const count3 = await addSubs(maintenanceSubCategories, maintenanceCategory.id);
  const count4 = await addSubs(accessorySubCategories, accessoryCategory.id);
  const count5 = await addSubs(brandSubCategories, brandCategory.id);

  console.log(`🎉 Toplam ${count1 + count2 + count3 + count4 + count5} alt kategori başarıyla eklendi!`);

  // 7. Markalar (Brand Tablosuna Ekleme)
  console.log("🏷️ Markalar ekleniyor...");
  const brands = [
    "Monero", "Gms", "Ncr", "Tvr", "Srn", "Gogo", 
    "Givis", "Bajaj", "Jet Motor", "Tvs", "Mondial", "Kuba"
  ];

  let brandCount = 0;
  for (const bName of brands) {
    const bSlug = bName.toLowerCase().replace(/ /g, "-");
    await prisma.brand.upsert({
      where: { name: bName },
      update: {},
      create: {
        name: bName,
        slug: bSlug,
      },
    });
    brandCount++;
  }

  console.log(`✅ ${brandCount} adet marka başarıyla eklendi!`);

  // 8. Marka Model Kategorileri (Markaya Göre > Marka > Model)
  console.log("🏍️ Marka model kategorileri ekleniyor...");

  const brandModels: { brand: string; models: string[] }[] = [
    {
      brand: "Mondial",
      models: [
        "100 KH", "125 KT", "125 MH Drift", "150 KN", "150 Mash",
        "150 MH Drift", "150 MR Vulture", "50 Revival", "50 Turismo",
        "50 ZNU", "Drift 125 L", "KD-125 F", "Mash 125 i", "Mct 250",
        "MG Superboy", "RX3-İ Evo", "Strada 125", "Virago 50",
        "Vulture 125 i Euro4", "Wing 50", "X-Treme Max 150",
        "X-Treme Max 200", "X-Treme Maxx 200 i", "ZNU", "Zone"
      ]
    },
    {
      brand: "Bajaj",
      models: [
        "Avenger", "Boxer", "Discover", "Dominar 250", "Dominar 400",
        "Dominar 400 UG", "N 125", "Pulsar", "Pulsar F 250", "Pulsar N 250",
        "Pulsar NS 200 UG2", "Pulsar NS 400 Z", "Qute", "RS 200 UG", "V15 Motor"
      ]
    },
    {
      brand: "Cf Moto",
      models: [
        "250 CL-X", "250 SR", "450 NK Yedek Parça", "450 SR",
        "NK 150", "NK 250", "NK 250 E5", "NK 400"
      ]
    },
    {
      brand: "Kanuni",
      models: [
        "Kanuni Atv", "Mati 125", "Seha 125", "Seha 150",
        "Seyhan 125 T", "Seyhan 150 C", "Tiger 250", "Trodon 50"
      ]
    },
    {
      brand: "RKS",
      models: [
        "RKS Blackwolf 250", "RKS Blazer XR", "RKS Newlight 125",
        "RKS Pollo 50", "RKS R250", "RKS Sniper 50 X",
        "RKS Spontini 110", "RKS XVR 250"
      ]
    },
    {
      brand: "TVS",
      models: ["Raider", "RTR 200 4V FI", "TVS Jupiter 125 Yedek Parça"]
    },
    {
      brand: "Honda",
      models: [
        "Titan", "ACE 125", "Activa 125 2023", "Activa S", "ADV 350",
        "CB 125 E", "CB 125 F", "CB 125 F 2023", "CB 250 R", "CBF 150",
        "CBR 125", "CBR 250 R", "CL 250", "CRF 250 L", "CRF 250 Rally",
        "Dio 110", "Forza 250", "GL 1800 Gold Wing", "NC 750", "NX 500",
        "PCX 125", "PCX 125 2018-2020", "PCX 125 2021", "PCX 125 DX",
        "PCX 150", "SH 125 i", "Spacy 110", "Today 50"
      ]
    },
    {
      brand: "Arora",
      models: ["Cappucino"]
    },
    {
      brand: "Chopper",
      models: ["250 Mct", "250 Regal", "250 Rmz", "250 Seyhan"]
    },
    {
      brand: "KTM",
      models: [
        "KTM 250 ADV", "KTM 390 ADV", "KTM Duke 250",
        "KTM Duke 390", "KTM RC 390"
      ]
    },
    {
      brand: "Suzuki",
      models: ["Suzuki Adress 110", "Suzuki İnazuma"]
    },
    {
      brand: "Yamaha",
      models: [
        "Crypton", "Delight", "MT 25", "N Max", "X-MAX 250",
        "YBR 125", "YS 125", "YZF R25", "YZF R25 2019"
      ]
    },
    {
      brand: "Hero",
      models: ["XPulse"]
    },
    {
      brand: "Kuba",
      models: [
        "Kuba CR1", "Kuba TK 03", "Kuba Trendy 50",
        "Kuba VN 50", "RKS NR 200", "Rocca 100", "Space 50"
      ]
    }
  ];

  let modelCount = 0;
  for (const { brand, models } of brandModels) {
    // Marka kategorisini bul (zaten var)
    const brandSlug = brand.toLowerCase()
      .replace(/ /g, "-")
      .replace(/[ığüşöç]/g, (m) => ({ 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c' }[m] || m));

    const brandCat = await prisma.category.findUnique({ where: { slug: brandSlug } });
    if (!brandCat) {
      console.warn(`⚠️ Marka kategorisi bulunamadı: ${brand} (slug: ${brandSlug})`);
      continue;
    }

    for (const model of models) {
      const modelSlug = `${brandSlug}-${model.toLowerCase()
        .replace(/ /g, "-")
        .replace(/[ığüşöçİ]/g, (m) => ({ 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c', 'İ': 'i' }[m] || m))
        .replace(/[^a-z0-9-]/g, "")}`;

      await prisma.category.upsert({
        where: { slug: modelSlug },
        update: { parentId: brandCat.id },
        create: {
          name: model,
          slug: modelSlug,
          parentId: brandCat.id,
        },
      });
      modelCount++;
    }
    console.log(`  ✅ ${brand}: ${models.length} model eklendi`);
  }

  console.log(`🎉 Toplam ${modelCount} adet model kategorisi başarıyla eklendi!`);
}

main()
  .catch((e) => {
    console.error("❌ Hata oluştu:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
