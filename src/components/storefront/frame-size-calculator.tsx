"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Info, HelpCircle, ArrowRight, Check } from "lucide-react";

interface Category {
    id: string;
    name: string;
    slug: string;
}

interface FrameSizeCalculatorProps {
    categories: Category[];
}

export function FrameSizeCalculator({ categories }: FrameSizeCalculatorProps) {
    const [height, setHeight] = useState(175);
    const [inseam, setInseam] = useState(80);
    const [autoCalculateInseam, setAutoCalculateInseam] = useState(true);

    // Calculate inseam automatically when height changes, if option is enabled
    useEffect(() => {
        if (autoCalculateInseam) {
            // Average inseam is roughly 46% of height
            const estimatedInseam = Math.round(height * 0.457);
            setInseam(estimatedInseam);
        }
    }, [height, autoCalculateInseam]);

    // Find target category slugs dynamically
    const getCategorySlug = (keywords: string[], fallback: string) => {
        const found = categories.find((c) =>
            keywords.some((keyword) => c.name.toLowerCase().includes(keyword))
        );
        return found ? found.slug : fallback;
    };

    const dagSlug = getCategorySlug(["dağ", "mtb", "mountain"], "dag-bisikletleri");
    const yolSlug = getCategorySlug(["yol", "yarış", "road", "race"], "yol-bisikletleri");
    const sehirSlug = getCategorySlug(["şehir", "tur", "trekking", "city"], "sehir-tur-bisikletleri");

    // Sizing calculations
    const yolCm = Math.round(inseam * 0.66 * 10) / 10;
    const yolLetter =
        yolCm < 49 ? "XS (47-49 cm)" :
        yolCm < 52 ? "S (50-52 cm)" :
        yolCm < 55 ? "M (53-55 cm)" :
        yolCm < 58 ? "L (56-58 cm)" :
        yolCm < 61 ? "XL (59-61 cm)" : "XXL (62+ cm)";

    const dagInches = Math.round((inseam * 0.57) / 2.54 * 10) / 10;
    const dagLetter =
        dagInches < 15 ? "XS (13\"-14\")" :
        dagInches < 17 ? "S (15\"-16\")" :
        dagInches < 19 ? "M (17\"-18\")" :
        dagInches < 21 ? "L (19\"-20\")" :
        dagInches < 23 ? "XL (21\"-22\")" : "XXL (23\"+)";

    const sehirCm = Math.round(inseam * 0.63 * 10) / 10;
    const sehirInches = Math.round(sehirCm / 2.54 * 10) / 10;
    const sehirLetter =
        sehirCm < 48 ? "XS (16\"-17\" / 45-47 cm)" :
        sehirCm < 52 ? "S (18\"-19\" / 48-51 cm)" :
        sehirCm < 56 ? "M (20\"-21\" / 52-55 cm)" :
        sehirCm < 60 ? "L (22\"-23\" / 56-59 cm)" :
        sehirCm < 63 ? "XL (24\"-25\" / 60-62 cm)" : "XXL (25\"+ / 63+ cm)";

    return (
        <section className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 border border-gray-200/50 dark:border-gray-800/50 rounded-3xl p-6 md:p-10 shadow-xl overflow-hidden relative">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />

            <div className="relative max-w-6xl mx-auto">
                <div className="text-center max-w-2xl mx-auto mb-10">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#17457C]/10 text-[#17457C] dark:bg-blue-900/30 dark:text-blue-400 mb-3">
                        <Info className="h-3 w-3" /> Akıllı Hesaplama Aracı
                    </span>
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl tracking-tight">
                        Bisiklet Kadro Boyu Hesaplama Aracı
                    </h2>
                    <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
                        Vücut ölçülerinize en uygun bisiklet kadro boyunu saniyeler içinde hesaplayın ve doğru sürüş konforuna kavuşun.
                    </p>
                </div>

                <div className="grid gap-10 lg:grid-cols-12 items-start">
                    {/* Input Controls Panel */}
                    <div className="lg:col-span-5 bg-white dark:bg-gray-900 p-6 md:p-8 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-lg space-y-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white pb-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                            Ölçülerinizi Girin
                        </h3>

                        {/* Height Input */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    Boyunuz (Cm)
                                </label>
                                <span className="text-lg font-extrabold text-[#17457C] dark:text-blue-400 bg-[#17457C]/5 dark:bg-blue-900/20 px-3 py-1 rounded-lg">
                                    {height} cm
                                </span>
                            </div>
                            <input
                                type="range"
                                min="140"
                                max="210"
                                value={height}
                                onChange={(e) => setHeight(Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#17457C] dark:accent-blue-500"
                            />
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>140 cm</span>
                                <span>210 cm</span>
                            </div>
                        </div>

                        {/* Inseam Auto-Calculate Toggle */}
                        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                            <input
                                type="checkbox"
                                id="autoInseam"
                                checked={autoCalculateInseam}
                                onChange={(e) => setAutoCalculateInseam(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-[#17457C] focus:ring-[#17457C] dark:border-gray-700 dark:bg-gray-800 cursor-pointer"
                            />
                            <label htmlFor="autoInseam" className="text-xs font-semibold text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                                İç bacak boyumu bilmiyorum (Otomatik Hesapla)
                            </label>
                        </div>

                        {/* Inseam Input */}
                        <div className={`space-y-3 transition-opacity duration-300 ${autoCalculateInseam ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    İç Bacak Boyunuz (Cm)
                                </label>
                                <span className="text-lg font-extrabold text-[#17457C] dark:text-blue-400 bg-[#17457C]/5 dark:bg-blue-900/20 px-3 py-1 rounded-lg">
                                    {inseam} cm
                                </span>
                            </div>
                            <input
                                type="range"
                                min="60"
                                max="105"
                                value={inseam}
                                disabled={autoCalculateInseam}
                                onChange={(e) => setInseam(Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#17457C] dark:accent-blue-500"
                            />
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>60 cm</span>
                                <span>105 cm</span>
                            </div>
                        </div>

                        {/* Visual measurement guide */}
                        <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100/30 dark:border-blue-900/30">
                            <h4 className="text-xs font-bold text-[#17457C] dark:text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <HelpCircle className="h-3.5 w-3.5" /> İç Bacak Boyu Nasıl Ölçülür?
                            </h4>
                            <div className="flex gap-4 items-start">
                                {/* Simple SVG Illustration */}
                                <svg width="60" height="90" viewBox="0 0 60 90" className="text-gray-400 dark:text-gray-600 flex-shrink-0">
                                    {/* Wall line */}
                                    <line x1="10" y1="5" x2="10" y2="85" stroke="currentColor" strokeWidth="2" strokeDasharray="3,3" />
                                    {/* Head & Body */}
                                    <circle cx="28" cy="18" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
                                    <line x1="28" y1="26" x2="28" y2="55" stroke="currentColor" strokeWidth="2" />
                                    {/* Arms */}
                                    <line x1="20" y1="30" x2="20" y2="50" stroke="currentColor" strokeWidth="2" />
                                    <line x1="36" y1="30" x2="36" y2="50" stroke="currentColor" strokeWidth="2" />
                                    {/* Legs */}
                                    <line x1="24" y1="55" x2="22" y2="85" stroke="currentColor" strokeWidth="2" />
                                    <line x1="32" y1="55" x2="34" y2="85" stroke="currentColor" strokeWidth="2" />
                                    {/* Book (horizontal line at crotch) */}
                                    <rect x="10" y="52" width="22" height="4" fill="#17457C" className="dark:fill-blue-500" />
                                    {/* Dimension Arrow for Inseam */}
                                    <line x1="15" y1="54" x2="15" y2="85" stroke="#17457C" strokeWidth="1.5" className="dark:stroke-blue-500" />
                                    <polygon points="15,54 12,59 18,59" fill="#17457C" className="dark:fill-blue-500" />
                                    <polygon points="15,85 12,80 18,80" fill="#17457C" className="dark:fill-blue-500" />
                                </svg>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    Sırtınızı duvara yaslayarak çıplak ayakla dik durun. Bacak aranıza (apış arasına) sert bir kitap yerleştirin. Kitabın üst kenarından zemine kadar olan mesafeyi ölçün.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Results Display Panel */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-3">
                            {/* Road Bike Card */}
                            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-lg p-5 flex flex-col justify-between h-full transition-transform hover:-translate-y-1 hover:shadow-xl">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-xs font-bold uppercase tracking-wider text-[#17457C] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-full">
                                            Yol / Yarış
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-3xl font-black text-gray-900 dark:text-white">
                                            {yolCm} <span className="text-sm font-semibold text-gray-500">cm</span>
                                        </div>
                                        <div className="text-sm font-bold text-gray-600 dark:text-gray-300">
                                            Beden: {yolLetter}
                                        </div>
                                    </div>
                                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                        Hız ve asfalt sürüşü odaklı kadro hesaplaması. `İç Bacak Boyu × 0.66` formülü temel alınmıştır.
                                    </p>
                                </div>
                                <div className="mt-6">
                                    <Link href={`/category/${yolSlug}`}>
                                        <button className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#17457C] hover:bg-[#0f3460] text-white text-xs font-bold rounded-xl transition-all shadow-md">
                                            Modelleri İncele <ArrowRight className="h-3.5 w-3.5" />
                                        </button>
                                    </Link>
                                </div>
                            </div>

                            {/* Mountain Bike Card */}
                            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-lg p-5 flex flex-col justify-between h-full transition-transform hover:-translate-y-1 hover:shadow-xl">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 px-2.5 py-1 rounded-full">
                                            Dağ (MTB)
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-3xl font-black text-gray-900 dark:text-white">
                                            {dagInches}&quot; <span className="text-sm font-semibold text-gray-500">inç</span>
                                        </div>
                                        <div className="text-sm font-bold text-gray-600 dark:text-gray-300">
                                            Beden: {dagLetter}
                                        </div>
                                    </div>
                                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                        Arazi ve bozuk zemin sürüşleri için daha küçük ve kıvrak kadrolar. `İç Bacak Boyu × 0.57` temel alınmıştır.
                                    </p>
                                </div>
                                <div className="mt-6">
                                    <Link href={`/category/${dagSlug}`}>
                                        <button className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-all shadow-md">
                                            Modelleri İncele <ArrowRight className="h-3.5 w-3.5" />
                                        </button>
                                    </Link>
                                </div>
                            </div>

                            {/* City/Trekking Bike Card */}
                            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-lg p-5 flex flex-col justify-between h-full transition-transform hover:-translate-y-1 hover:shadow-xl">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full">
                                            Şehir / Tur
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-3xl font-black text-gray-900 dark:text-white">
                                            {sehirCm} <span className="text-sm font-semibold text-gray-500">cm</span>
                                        </div>
                                        <div className="text-sm font-bold text-gray-600 dark:text-gray-300">
                                            Beden: {sehirLetter}
                                        </div>
                                    </div>
                                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                        Günlük ulaşım ve uzun turlar için konfor odaklı geometriler. `İç Bacak Boyu × 0.63` temel alınmıştır.
                                    </p>
                                </div>
                                <div className="mt-6">
                                    <Link href={`/category/${sehirSlug}`}>
                                        <button className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-md">
                                            Modelleri İncele <ArrowRight className="h-3.5 w-3.5" />
                                        </button>
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* Interactive tips footer */}
                        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-lg">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
                                İki Beden Arasında Kalırsanız Hangisini Seçmelisiniz?
                            </h4>
                            <ul className="grid gap-3 sm:grid-cols-2 text-xs text-gray-600 dark:text-gray-400">
                                <li className="flex gap-2 items-start">
                                    <span className="w-4 h-4 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Check className="w-3 h-3" />
                                    </span>
                                    <span>
                                        <strong>Küçük Kadro:</strong> Daha sportif, hafif, kıvrak bir sürüş istiyorsanız veya yarış tarzı kullanım için küçük kadroyu seçin.
                                    </span>
                                </li>
                                <li className="flex gap-2 items-start">
                                    <span className="w-4 h-4 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Check className="w-3 h-3" />
                                    </span>
                                    <span>
                                        <strong>Büyük Kadro:</strong> Daha dik, konfor odaklı, omuz/boyun ağrısı yaşamayacağınız bir tur/gezi sürüşü için büyük kadroyu seçin.
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
