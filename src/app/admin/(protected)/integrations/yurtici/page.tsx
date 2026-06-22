import { prisma } from "@/lib/db";
import { YurticiKargoSettingsForm } from "./yurtici-settings-form";

export const metadata = {
    title: "Yurtiçi Kargo Entegrasyonu | Admin",
};

export default async function YurticiIntegrationPage() {
    const config = await prisma.yurticiKargoConfig.findFirst();

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="text-2xl">📦</span> Yurtiçi Kargo Entegrasyonu
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Web servis entegrasyonu ile sipariş gönderimlerini Yurtiçi Kargo sistemine aktarın.
                </p>
            </div>

            {/* Uyarı Bandı - Test Modu */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 flex items-start gap-3">
                <span className="text-yellow-600 text-xl shrink-0">⚠️</span>
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    <p className="font-semibold mb-1">Canlı kullanıcı bilgileri alınana kadar Test Mod aktif kalmalıdır.</p>
                    <p>
                        Test ortamı: <code className="bg-yellow-100 dark:bg-yellow-900/50 px-1.5 py-0.5 rounded text-xs font-mono">testwebservices.yurticikargo.com:9090</code>
                    </p>
                    <p className="mt-1">
                        Test credentials: <code className="bg-yellow-100 dark:bg-yellow-900/50 px-1.5 py-0.5 rounded text-xs font-mono">YKTEST / YK</code> (otomatik kullanılır)
                    </p>
                </div>
            </div>

            {/* Bilgi Kartları */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-900 border rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-orange-600">createShipment</p>
                    <p className="text-xs text-gray-500 mt-1">Gönderi Oluştur</p>
                </div>
                <div className="bg-white dark:bg-gray-900 border rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-[#17457C]">queryShipment</p>
                    <p className="text-xs text-gray-500 mt-1">Durum Sorgula</p>
                </div>
                <div className="bg-white dark:bg-gray-900 border rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-red-600">cancelShipment</p>
                    <p className="text-xs text-gray-500 mt-1">Gönderi İptal</p>
                </div>
            </div>

            {/* Ayar Formu */}
            <YurticiKargoSettingsForm config={config} />

            {/* Süreç Akışı */}
            <div className="bg-white dark:bg-gray-900 border rounded-lg p-5 space-y-3">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Entegrasyon Akışı</h3>
                <ol className="space-y-2">
                    {[
                        "Sipariş \"Hazırlanıyor\" durumuna geçince admin \"YK'ya Gönder\" butonuna basar.",
                        "createShipment servisi çağrılır → YK sistemi Job ID döndürür.",
                        "Kargo fiziken YK şubesine verilir — şube cargoKey ile kaydı bulur.",
                        "YK şubesi taşıma irsaliyesi oluşturur.",
                        "\"Durumu Sorgula\" butonu ile kargo durumu güncel tutulur.",
                        "Kargo teslim edildiğinde operationStatus = DLV olur.",
                    ].map((step, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
                            <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                {i + 1}
                            </span>
                            {step}
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    );
}
