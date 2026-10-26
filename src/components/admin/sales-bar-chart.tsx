import { formatPrice } from "@/lib/helpers";

/**
 * Son 30 günün günlük cirosu: kütüphanesiz SVG (sunucuda çizilir, tarayıcıya JS gitmez).
 * Çubuğun üzerine gelince tarih, ciro ve sipariş sayısı tarayıcının kendi ipucuyla görünür.
 */
export function SalesBarChart({ data }: { data: { date: string; revenue: number; orders: number }[] }) {
    const W = 600;
    const H = 180;
    const PAD_B = 18;
    const max = Math.max(1, ...data.map((d) => d.revenue));
    const barW = W / data.length;
    const fmtDay = (iso: string) => {
        const [, m, d] = iso.split("-");
        return `${Number(d)}.${Number(m)}`;
    };
    const total = data.reduce((a, b) => a + b.revenue, 0);
    const orders = data.reduce((a, b) => a + b.orders, 0);

    return (
        <div>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3">
                <span className="text-xl font-bold text-gray-900 dark:text-white">{formatPrice(total)}</span>
                <span className="text-sm text-gray-500">{orders} sipariş · günlük ortalama {formatPrice(total / data.length)}</span>
            </div>
            {/* w-full h-auto: grafik kartın tamamına yayılır (sabit yükseklikte en/boy oranı yüzünden ortada dar kalıyordu) */}
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto text-[#17457C] dark:text-blue-400" role="img" aria-label="Son 30 günün günlük cirosu">
                {/* yatay kılavuz çizgileri */}
                {[0.25, 0.5, 0.75, 1].map((f) => (
                    <line key={f} x1="0" x2={W} y1={(H - PAD_B) * (1 - f)} y2={(H - PAD_B) * (1 - f)} className="stroke-gray-100 dark:stroke-gray-800" strokeWidth="1" />
                ))}
                {data.map((d, i) => {
                    const h = d.revenue > 0 ? Math.max(2, ((H - PAD_B) * d.revenue) / max) : 0;
                    const isLast = i === data.length - 1;
                    return (
                        <g key={d.date}>
                            <title>{`${fmtDay(d.date)}: ${formatPrice(d.revenue)} · ${d.orders} sipariş`}</title>
                            {/* görünmez geniş alan: ince çubuklarda da üzerine gelmek kolay olsun */}
                            <rect x={i * barW} y="0" width={barW} height={H - PAD_B} fill="transparent" />
                            <rect
                                x={i * barW + barW * 0.15}
                                y={H - PAD_B - h}
                                width={barW * 0.7}
                                height={h}
                                rx="2"
                                fill="currentColor"
                                opacity={isLast ? 1 : 0.75}
                            />
                            {(i % 5 === 0 || isLast) && (
                                <text x={i * barW + barW / 2} y={H - 4} textAnchor="middle" className="fill-gray-400" fontSize="10">
                                    {isLast ? "Bugün" : fmtDay(d.date)}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
