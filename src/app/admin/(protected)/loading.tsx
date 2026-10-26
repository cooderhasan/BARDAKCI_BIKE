/**
 * Yönetim sayfaları arası geçişte anında görünen hafif yükleniyor ekranı.
 * Ayrıca linklerin arka plan ön yüklemesi bu sınırda durur: menü/pano linkleri artık
 * her sayfa açılışında hedef sayfaları sunucuda baştan sona çizdirmiyor.
 */
export default function AdminLoading() {
    return (
        <div className="flex min-h-[50vh] items-center justify-center" aria-busy="true" aria-live="polite">
            <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-[#17457C] dark:border-gray-700 dark:border-t-blue-400" />
                Yükleniyor...
            </div>
        </div>
    );
}
