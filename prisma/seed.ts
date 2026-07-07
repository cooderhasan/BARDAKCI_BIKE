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
                phone: "0554 014 41 42",
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

    // Create default FAQs
    const faqs = [
        {
            id: "faq-1",
            question: "Nasıl üye olabilirim ve fiyatları görebilirim?",
            answer: "Sitemizin sağ üst köşesinde bulunan 'Giriş Yap/Kayıt Ol' bölümünden üyelik formunu doldurarak hızlıca üye olabilirsiniz. Bayi (B2B) fiyatlarını ve özel iskontoları görebilmek için üye olduktan sonra hesabınızın yönetici ekibimiz tarafından incelenip 'Bayi' statüsüne onaylanması gerekmektedir.",
            category: "membership",
            order: 1
        },
        {
            id: "faq-2",
            question: "Bayilik başvurusu için hangi evraklar gereklidir?",
            answer: "Üyelik kaydınızı oluşturduktan sonra, bayi statüsünün onaylanması için firmanıza ait Vergi Levhası ve Faaliyet Belgesi gibi temel ticari belgeleri talep etmekteyiz. Bu belgeleri profilinizden yükleyebilir ya da doğrudan WhatsApp / E-posta destek hattımız üzerinden bizimle paylaşabilirsiniz.",
            category: "membership",
            order: 2
        },
        {
            id: "faq-3",
            question: "Bayilere özel iskonto oranları nasıl belirlenir?",
            answer: "Bayi iskonto oranlarımız; bayimizin yıllık alım taahhüdü, sipariş sıklığı ve ödeme tipine (Nakit, Havale/EFT, Kredi Kartı) göre kademelendirilmektedir. Onaylanan bayilerimiz kendilerine tanımlanan özel indirimli fiyatları sisteme giriş yaptıktan sonra otomatik olarak görürler.",
            category: "membership",
            order: 3
        },
        {
            id: "faq-4",
            question: "Hangi ödeme yöntemlerini kullanabilirim?",
            answer: "Siparişlerinizde Güvenli Kredi Kartı ile Ödeme (PayTR altyapısı ile tek çekim veya taksit seçenekleri) veya Banka Havalesi / EFT yöntemlerini kullanabilirsiniz. Onaylı ve limiti bulunan anlaşmalı bayilerimiz için cari hesap ile ödeme seçeneği de aktif edilmektedir.",
            category: "orders",
            order: 1
        },
        {
            id: "faq-5",
            question: "Minimum sipariş limiti (Sepet Limiti) var mı?",
            answer: "Perakende alışverişleriniz için herhangi bir minimum sipariş limiti bulunmamaktadır. Ancak B2B toptan bayi fiyatlarından faydalanabilmek ve kargo avantajlarından yararlanabilmek için belirlenen asgari sipariş tutarlarına ulaşmanız gerekebilir. Güncel limitleri sepet sayfanızda görebilirsiniz.",
            category: "orders",
            order: 2
        },
        {
            id: "faq-6",
            question: "Kredi kartına taksit imkanı var mı?",
            answer: "Evet, tüm anlaşmalı banka kredi kartlarına (Bonus, World, Axess, Maximum, CardFinans, Paraf) PayTR güvencesiyle 12 aya varan taksit seçenekleri sunmaktayız. Taksit oranları ve vade farkı detayları ödeme sayfasında kart bilgilerinizi girdiğinizde listelenir.",
            category: "orders",
            order: 3
        },
        {
            id: "faq-7",
            question: "Siparişler ne kadar sürede kargoya verilir?",
            answer: "Hafta içi saat 14:00'e kadar verilen ve ödemesi onaylanan siparişleriniz genellikle aynı gün, bu saatten sonraki siparişler ise en geç bir sonraki iş günü içerisinde kargoya teslim edilmektedir. Toplu B2B siparişlerinizde kargo hazırlık süresi sipariş hacmine göre 1-2 iş günü sürebilir.",
            category: "shipping",
            order: 1
        },
        {
            id: "faq-8",
            question: "Kargo ücreti ne kadar? Ücretsiz kargo limiti var mı?",
            answer: "Belirli bir tutarın üzerindeki alışverişlerinizde kargo ücretsizdir. Toptan siparişlerde ise hacim ve ağırlığa (Desi) bağlı olarak en uygun anlaşmalı ambar veya kargo firmaları tercih edilmektedir. Kargo detaylarını sipariş onay aşamasında görebilirsiniz.",
            category: "shipping",
            order: 2
        },
        {
            id: "faq-9",
            question: "Kargodan gelen koliyi teslim alırken nelere dikkat etmeliyim?",
            answer: "Gelen kargonun dış kutusunda ezilme, yırtılma veya ıslanma gibi bir hasar varsa kesinlikle teslim almayınız ve kargo görevlisine 'Hasar Tespit Tutanağı' tutturunuz. Tutanak tutulmayan kargolarda, taşıma esnasında oluşabilecek hasarrlardan firmamız sorumlu tutulamamaktadır.",
            category: "shipping",
            order: 3
        },
        {
            id: "faq-10",
            question: "Satın aldığım bisikletin kurulumu nasıl yapılır? Ücretli midir?",
            answer: "Satın aldığınız tüm orijinal bisikletler kutulu ve yarı demonte olarak gönderilir. Garanti kapsamının başlaması için bisikletinizi kesinlikle yetkili Bisan, Ümit veya ilgili markanın anlaşmalı yetkili servisinde kurdurmanız gerekmektedir. Anlaşmalı yetkili servislerde ilk kurulum tamamen ücretsizdir. Kurulumu kendiniz yapmanız durumunda ürün garanti kapsamı dışında kalır.",
            category: "service",
            order: 1
        },
        {
            id: "faq-11",
            question: "Ürünlerin garanti süresi ne kadardır?",
            answer: "Sitemizde satışı yapılan tüm bisikletler ve elektrikli araçlar, üretici veya ithalatçı firma garantisi altında olup asgari 2 yıl (24 ay) resmi garantilidir. Kutu içerisinden çıkan garanti belgesini ve adınıza düzenlenen faturayı garanti süresi boyunca saklamanız gerekmektedir.",
            category: "service",
            order: 2
        },
        {
            id: "faq-12",
            question: "İade ve değişim prosedürünüz nedir?",
            answer: "Tüketici Kanunu gereği, satın aldığınız kutusu açılmamış, kurulmamış ve kullanılmamış ürünleri 14 gün içerisinde herhangi bir gerekçe göstermeksizin iade edebilirsiniz. İade edilecek ürünün orijinal kutusu, faturası ve tüm aparatlarıyla birlikte eksiksiz gönderilmesi gerekmektedir. B2B toptan alımlarda iade süreçleri ticari sözleşme şartlarına tabidir.",
            category: "service",
            order: 3
        }
    ];

    for (const faq of faqs) {
        await prisma.fAQ.upsert({
            where: { id: faq.id },
            update: {},
            create: {
                id: faq.id,
                question: faq.question,
                answer: faq.answer,
                category: faq.category,
                order: faq.order,
                isActive: true
            }
        });
    }

    console.log("✅ Created default FAQs");

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

