"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Send } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getStockNotificationSummary, sendStockNotificationsNow } from "@/app/admin/(protected)/stock-alerts/actions";

type Summary = Awaited<ReturnType<typeof getStockNotificationSummary>>;
type Tab = "top" | "pending" | "sent";

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** "Gelince Haber Ver" talepleri: en çok beklenen ürünler, bekleyen ve gönderilen talepler */
export function StockNotificationsPanel() {
    const [data, setData] = useState<Summary | null>(null);
    const [sending, setSending] = useState(false);
    const [tab, setTab] = useState<Tab>("top");

    const load = () => getStockNotificationSummary().then(setData).catch(() => setData(null));
    useEffect(() => { load(); }, []);

    const sendNow = async () => {
        if (!confirm("Stoğa girmiş ürünleri bekleyenlere şimdi e-posta gönderilsin mi? (Günlük gönderim sınırı geçerlidir)")) return;
        setSending(true);
        try {
            const res = await sendStockNotificationsNow();
            if (res.success) toast.success(res.message, { duration: 15000 });
            else toast.error(res.message);
            load();
        } finally {
            setSending(false);
        }
    };

    const tabs: { key: Tab; label: string }[] = [
        { key: "top", label: "En Çok Beklenen" },
        { key: "pending", label: `Bekleyen Talepler${data ? ` (${data.pendingTotal})` : ""}` },
        { key: "sent", label: "Gönderilenler" },
    ];

    const rows = tab === "pending" ? data?.pendingList : tab === "sent" ? data?.sentList : null;

    return (
        <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <Bell className="h-5 w-5 text-[#17457C]" />
                    Gelince Haber Ver Talepleri
                    {data ? (
                        <span className="text-sm font-normal text-gray-500">
                            ({data.pendingTotal} bekleyen, son 30 günde {data.sentLast30Days} e-posta gönderildi)
                        </span>
                    ) : null}
                </CardTitle>
                <Button size="sm" variant="outline" onClick={sendNow} disabled={sending}>
                    <Send className="mr-2 h-4 w-4" />
                    {sending ? "Gönderiliyor..." : "Şimdi Gönder"}
                </Button>
            </CardHeader>
            <CardContent>
                <p className="mb-3 text-xs text-gray-500">
                    E-postalar her gün 11:00&apos;de, stoğa giren ürünleri bekleyenlere otomatik gönderilir. Gönderilen talep kapanır ve &quot;Gönderilenler&quot;e geçer.
                </p>

                <div className="mb-3 flex flex-wrap gap-1">
                    {tabs.map((t) => (
                        <Button
                            key={t.key}
                            size="sm"
                            variant={tab === t.key ? "default" : "outline"}
                            className="h-8 text-xs"
                            onClick={() => setTab(t.key)}
                        >
                            {t.label}
                        </Button>
                    ))}
                </div>

                {tab === "top" ? (
                    !data || data.products.length === 0 ? (
                        <p className="text-sm text-gray-500">Bekleyen talep yok.</p>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {data.products.map((p) => (
                                <div key={p.productId} className="flex items-center justify-between gap-3 py-2 text-sm">
                                    <div className="min-w-0">
                                        <Link href={`/admin/products/${p.productId}/edit`} className="block truncate font-medium hover:underline">
                                            {p.name}
                                        </Link>
                                        <span className="text-xs text-gray-500">{p.sku || "-"} · stok {p.stock}</span>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-[#17457C]/10 px-2.5 py-0.5 text-xs font-bold text-[#17457C]">
                                        {p.waiting} kişi bekliyor
                                    </span>
                                </div>
                            ))}
                        </div>
                    )
                ) : !rows || rows.length === 0 ? (
                    <p className="text-sm text-gray-500">{tab === "pending" ? "Bekleyen talep yok." : "Henüz gönderilmiş e-posta yok."}</p>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {rows.map((r) => (
                            <div key={r.id} className="flex flex-col gap-0.5 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                <div className="min-w-0">
                                    <Link href={`/admin/products/${r.productId}/edit`} className="block truncate font-medium hover:underline">
                                        {r.productName}{r.variantLabel ? ` (${r.variantLabel})` : ""}
                                    </Link>
                                    <span className="break-all text-xs text-gray-500">{r.email}</span>
                                </div>
                                <span className="shrink-0 text-xs text-gray-500">
                                    {tab === "sent" && r.notifiedAt ? `Gönderildi: ${fmtDate(r.notifiedAt)}` : `Talep: ${fmtDate(r.createdAt)}`}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
