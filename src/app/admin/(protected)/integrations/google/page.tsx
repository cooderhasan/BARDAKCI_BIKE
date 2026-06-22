"use client";

import { useState, useEffect, useTransition } from "react";
import {
  getGoogleConfig,
  saveGoogleConfig,
  updateCategoryGoogleMapping,
  getCategories,
  getGoogleFeedStats,
  bulkActivateGoogle,
  bulkDeactivateGoogle,
} from "./actions";
import googleTaxonomy from "@/data/google-taxonomy.json";

export default function GoogleMerchantPage() {
  const [config, setConfig] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalActive: 0, totalProducts: 0, totalWithCategory: 0 });
  const [feedUrl, setFeedUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [catSearch, setCatSearch] = useState("");
  const [taxSearch, setTaxSearch] = useState<{ [catId: string]: string }>({});
  const [savingCat, setSavingCat] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [bulkMsg, setBulkMsg] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    setFeedUrl(window.location.origin + "/api/feed/google");
    Promise.all([getGoogleConfig(), getCategories(), getGoogleFeedStats()]).then(
      ([cfg, cats, st]) => {
        setConfig(cfg.data);
        setCategories(cats);
        if (st.success) setStats(st.data as any);
      }
    );
  }, []);

  const copyFeedUrl = () => {
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const result = await saveGoogleConfig(null, formData);
    setSaveMsg(result.message || "");
    setTimeout(() => setSaveMsg(""), 3000);
  };

  const handleCategoryMapping = async (categoryId: string, value: string) => {
    setSavingCat(categoryId);
    await updateCategoryGoogleMapping(categoryId, value || null);
    setCategories((prev) =>
      prev.map((c) =>
        c.id === categoryId ? { ...c, googleProductCategory: value || null } : c
      )
    );
    setSavingCat(null);
  };

  const handleBulkActivate = async () => {
    if (!confirm(`Tüm aktif ürünler (${stats.totalProducts} adet) Google Feed'e eklenecek. Devam?`)) return;
    setBulkLoading(true);
    setBulkMsg("");
    const result = await bulkActivateGoogle();
    setBulkMsg(result.message);
    setBulkLoading(false);
    // Refresh stats
    const st = await getGoogleFeedStats();
    if (st.success) setStats(st.data as any);
  };

  const handleBulkDeactivate = async () => {
    if (!confirm("Tüm ürünler Google Feed'den çıkarılacak. Devam?")) return;
    setBulkLoading(true);
    setBulkMsg("");
    const result = await bulkDeactivateGoogle();
    setBulkMsg(result.message);
    setBulkLoading(false);
    const st = await getGoogleFeedStats();
    if (st.success) setStats(st.data as any);
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(catSearch.toLowerCase())
  );

  const filteredTaxonomy = (catId: string) => {
    const q = (taxSearch[catId] || "").toLowerCase();
    if (!q) return googleTaxonomy;
    return googleTaxonomy.filter((t) => t.name.toLowerCase().includes(q));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center shadow-sm">
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Google Merchant Center</h1>
          <p className="text-sm text-gray-500">Google Shopping feed yönetimi ve kategori eşleştirmesi</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-700">{stats.totalProducts}</div>
          <div className="text-xs text-gray-500 mt-1">Toplam Aktif Ürün</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{stats.totalActive}</div>
          <div className="text-xs text-[#17457C] mt-1">Feed'e Dahil</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{stats.totalWithCategory}</div>
          <div className="text-xs text-green-600 mt-1">Kategori Eşleştirilmiş</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-700">{categories.filter(c => (c as any).googleProductCategory).length}</div>
          <div className="text-xs text-orange-600 mt-1">Eşleştirilmiş Kategori</div>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-1">🚀 Toplu İşlemler</h2>
        <p className="text-sm text-gray-500 mb-4">
          Tüm aktif ürünleri tek tıkla Google Feed'e ekleyebilir veya çıkarabilirsiniz.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleBulkActivate}
            disabled={bulkLoading}
            className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            {bulkLoading ? "İşleniyor..." : `✅ Tüm Ürünleri Ekle (${stats.totalProducts} ürün)`}
          </button>
          <button
            onClick={handleBulkDeactivate}
            disabled={bulkLoading}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            {bulkLoading ? "İşleniyor..." : "❌ Tümünü Çıkar"}
          </button>
        </div>
        {bulkMsg && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            {bulkMsg}
          </div>
        )}
      </div>

      {/* Feed URL */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-3">📡 Feed URL</h2>
        <p className="text-sm text-gray-500 mb-3">
          Bu URL'yi Google Merchant Center'da <strong>Ürünler → Veri Kaynakları → Ekle → Zamanlanmış Getirme</strong> bölümüne ekleyin.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={feedUrl}
            readOnly
            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-700 focus:outline-none"
          />
          <button
            onClick={copyFeedUrl}
            className="px-4 py-2 bg-[#17457C] hover:bg-[#0f3460] text-white text-sm font-medium rounded-lg transition-colors"
          >
            {copied ? "✓ Kopyalandı" : "Kopyala"}
          </button>
          <a
            href={feedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            Önizle →
          </a>
        </div>
      </div>

      {/* Merchant ID Settings */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-3">⚙️ Merchant Ayarları</h2>
        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Merchant ID <span className="text-gray-400 font-normal">(bilgi amaçlı)</span>
            </label>
            <input
              name="merchantId"
              type="text"
              defaultValue={config?.merchantId || ""}
              placeholder="örn: 123456789"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Site URL</label>
            <input
              name="siteUrl"
              type="text"
              defaultValue={config?.siteUrl || ""}
              placeholder="https://siteniz.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Kaydet
            </button>
            {saveMsg && <span className="text-sm text-green-600">{saveMsg}</span>}
          </div>
        </form>
      </div>

      {/* Category Mapping */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-1">🗂️ Kategori Eşleştirmesi</h2>
        <p className="text-sm text-gray-500 mb-4">
          Site kategorilerinizi Google'ın taxonomy sistemine eşleştirin. Bu sayede ürünleriniz doğru kategoride görünür.
        </p>

        <input
          type="text"
          placeholder="Kategori ara..."
          value={catSearch}
          onChange={(e) => setCatSearch(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="space-y-3">
          {filteredCategories.map((cat) => (
            <div
              key={cat.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100"
            >
              <div className="sm:w-1/3">
                <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                {(cat as any).googleProductCategory && (
                  <div className="text-xs text-green-600 mt-0.5">✓ Eşleştirildi</div>
                )}
              </div>
              <div className="sm:w-2/3 flex gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Google taxonomy ara..."
                    value={taxSearch[cat.id] || ""}
                    onChange={(e) =>
                      setTaxSearch((prev) => ({ ...prev, [cat.id]: e.target.value }))
                    }
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 mb-1"
                  />
                  <select
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                    value={(cat as any).googleProductCategory || ""}
                    onChange={(e) => handleCategoryMapping(cat.id, e.target.value)}
                  >
                    <option value="">-- Seçin --</option>
                    {filteredTaxonomy(cat.id).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                    {/* Fallback for cases where value is a name but we have only IDs in list, or vice versa */}
                    {(cat as any).googleProductCategory && !googleTaxonomy.find(t => t.id === (cat as any).googleProductCategory) && (
                        <option value={(cat as any).googleProductCategory}>{(cat as any).googleProductCategory}</option>
                    )}
                  </select>
                </div>
                {savingCat === cat.id && (
                  <div className="flex items-center text-xs text-blue-500">Kaydediliyor...</div>
                )}
              </div>
            </div>
          ))}
          {filteredCategories.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-4">Kategori bulunamadı.</div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h2 className="font-semibold text-blue-800 mb-3">📋 Kurulum Adımları</h2>
        <ol className="space-y-2 text-sm text-blue-800">
          <li className="flex gap-2"><span className="font-bold">1.</span> <span>Yukarıdaki <strong>Feed URL</strong>'yi kopyalayın.</span></li>
          <li className="flex gap-2"><span className="font-bold">2.</span> <span><a href="https://merchants.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Merchant Center</a>'a giriş yapın.</span></li>
          <li className="flex gap-2"><span className="font-bold">3.</span> <span><strong>Ürünler → Veri Kaynakları → + Ekle → Zamanlanmış Getirme</strong> seçin.</span></li>
          <li className="flex gap-2"><span className="font-bold">4.</span> <span>Feed URL'sini yapıştırın ve <strong>günlük güncelleme</strong> seçin.</span></li>
          <li className="flex gap-2"><span className="font-bold">5.</span> <span>Aşağıdaki kategori eşleştirmesini yapın.</span></li>
          <li className="flex gap-2"><span className="font-bold">6.</span> <span>Ürün düzenleme sayfasında <strong>"Google Feed"</strong> toggle'ını açın.</span></li>
        </ol>
      </div>
    </div>
  );
}
