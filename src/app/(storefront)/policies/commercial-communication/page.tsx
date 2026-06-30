import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";

export const metadata: Metadata = {
    title: "Elektronik Ticaret İleti Onayı | Bardakcı Bike",
    description: "Bardakcı Bike Ticari Elektronik İleti Onay Metni. Kampanya ve bilgilendirme duyuruları hakkındaki onay ve ret haklarınız.",
    alternates: {
        canonical: `${BASE_URL}/policies/commercial-communication`,
    },
};

export default function CommercialCommunicationPage() {
    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
                Elektronik Ticaret İleti Onayı
            </h1>

            <div className="prose dark:prose-invert max-w-none space-y-6 text-gray-600 dark:text-gray-300">
                <p>
                    [Şirket Adı] olarak, sizlere daha iyi hizmet verebilmek, kampanyalarımızdan, indirimlerimizden ve yeni ürünlerimizden haberdar edebilmek amacıyla ticari elektronik iletiler göndermekteyiz.
                </p>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8">
                    Onay Kapsamı
                </h3>
                <p>
                    İşbu onay metnini kabul ederek; Şirketimizin tarafınıza SMS, e-posta, telefon ve benzeri araçlarla ticari elektronik ileti göndermesine, verilerinizin bu amaçla kullanılmasına ve saklanmasına izin vermiş olursunuz.
                </p>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8">
                    Ret Hakkı
                </h3>
                <p>
                    Dilediğiniz zaman, hiçbir gerekçe göstermeksizin ticari elektronik ileti almayı reddedebilirsiniz. İleti alımını durdurmak için gönderilen iletilerdeki yönlendirmeleri takip edebilir veya müşteri hizmetlerimizle iletişime geçebilirsiniz.
                </p>
            </div>
        </div>
    );
}
