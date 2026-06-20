import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    try {
        // Try loading dotenv for local development
        const dotenv = await import("dotenv");
        dotenv.config();
    } catch (e) {
        // Ignore if dotenv is not found (e.g. in production where env vars are injected)
        console.log("Info: dotenv not loaded (using system environment variables)");
    }

    console.log("🌱 Seeding database...");

    // Create discount groups
    const discountGroups = await Promise.all([
        prisma.discountGroup.upsert({
            where: { name: "Standart Bayi" },
            update: {},
            create: { name: "Standart Bayi", discountRate: 0 },
        }),
        prisma.discountGroup.upsert({
            where: { name: "Bayi %5" },
            update: {},
            create: { name: "Bayi %5", discountRate: 5 },
        }),
        prisma.discountGroup.upsert({
            where: { name: "Bayi %10" },
            update: {},
            create: { name: "Bayi %10", discountRate: 10 },
        }),
        prisma.discountGroup.upsert({
            where: { name: "Bayi %15" },
            update: {},
            create: { name: "Bayi %15", discountRate: 15 },
        }),
        prisma.discountGroup.upsert({
            where: { name: "Bayi %20" },
            update: {},
            create: { name: "Bayi %20", discountRate: 20 },
        }),
    ]);

    console.log("✅ Created discount groups:", discountGroups.length);

    // Create admin user
    const adminEmail = process.env.ADMIN_EMAIL || "info@bardakcibike.com.tr";
    const adminPassword = await bcrypt.hash("Ahmet.91!Tufekci_2025*Guvenli", 12);
    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            passwordHash: adminPassword,
            role: "ADMIN",
            status: "APPROVED",
        },
        create: {
            email: adminEmail,
            passwordHash: adminPassword,
            companyName: "Bardakcı Bike Admin",
            role: "ADMIN",
            status: "APPROVED",
        },
    });

    console.log("✅ Created admin user:", admin.email);

    console.log("✅ (No sample categories or products seeded to keep the database clean)");

    // Create default site settings
    await prisma.siteSettings.upsert({
        where: { key: "general" },
        update: {},
        create: {
            key: "general",
            value: {
                siteName: "Bardakcı Bike",
                companyName: "Bardakcı Bike - Mehmet Fatih Bardakcı",
                phone: "0534 519 44 72",
                email: "info@bardakcibike.com.tr",
                address: "Yazır mah. Şafak Cd: No:32B SELÇUKLU / KONYA",
                taxOffice: "Meram Vergi Dairesi",
                taxNumber: "25403236566",
            },
        },
    });

    await prisma.siteSettings.upsert({
        where: { key: "bankAccounts" },
        update: {},
        create: {
            key: "bankAccounts",
            value: [
                {
                    bankName: "Garanti Bankası",
                    accountHolder: "Mehmet Fatih Bardakcı",
                    iban: "TR250006200077000006896031",
                },
            ],
        },
    });

    console.log("✅ Created site settings");

    // Create sample slider
    await prisma.slider.upsert({
        where: { id: "slider-1" },
        update: {},
        create: {
            id: "slider-1",
            title: "Toptan Alımlarda Özel Fiyatlar",
            subtitle: "Bayilerimize özel indirim oranlarıyla alışveriş yapın",
            imageUrl: "",
            linkUrl: "/products",
            order: 1,
            isActive: true,
        },
    });

    console.log("✅ Created slider");

    // Create default policies
    const policies = [
        { slug: "kvkk", title: "KVKK Aydınlatma Metni" },
        { slug: "privacy", title: "Gizlilik Politikası" },
        { slug: "distance-sales", title: "Mesafeli Satış Sözleşmesi" },
        { slug: "cancellation", title: "İptal ve İade Koşulları" },
        { slug: "cookies", title: "Çerez Politikası" },
        { slug: "payment-methods", title: "Ödeme Yöntemleri" },
    ];

    for (const policy of policies) {
        await prisma.policy.upsert({
            where: { slug: policy.slug },
            update: {},
            create: {
                slug: policy.slug,
                title: policy.title,
                content: `<h3>${policy.title}</h3><p>Bu metin varsayılan olarak oluşturulmuştur. Admin panelinden düzenleyebilirsiniz.</p>`,
            },
        });
    }

    console.log("✅ Created policies");

    console.log("🎉 Seeding completed!");
}

main()
    .catch((e) => {
        console.error("❌ Seeding error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
