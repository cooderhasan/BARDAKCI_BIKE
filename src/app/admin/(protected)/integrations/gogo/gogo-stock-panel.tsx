"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Eye, Play, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateGogoConfig, runGogoSync } from "./actions";
import type { GogoReport, GogoSettings } from "@/lib/supplier-stock/gogo";

const fmt = (iso?: string) =>
    iso ? new Date(iso).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

export function GogoStockPanel({ initial }: { initial: GogoSettings }) {
    const [url, setUrl] = useState(initial.url || "");
    const [enabled, setEnabled] = useState(!!initial.enabled);
    const [saving, setSaving] = useState(false);
    const [running, setRunning] = useState<"preview" | "apply" | null>(null);
    const [report, setReport] = useState<GogoReport | undefined>(initial.lastReport);
    const [lastRunAt, setLastRunAt] = useState<string | undefined>(initial.lastRunAt);
    const [previewOk, setPreviewOk] = useState(false);

    const save = async () => {
        setSaving(true);
        const res = await updateGogoConfig({ url, enabled });
        setSaving(false);
        if (res.success) toast.success("Ayarlar kaydedildi.");
        else toast.error(res.error || "Kaydedilemedi.");
    };

    const run = async (dryRun: boolean) => {
        if (!dryRun && !confirm(`${report?.changed ?? ""} ürünün stoğu güncellenip pazaryerlerine gönderilecek. Devam edilsin mi?`)) return;
        setRunning(dryRun ? "preview" : "apply");
        const res = await runGogoSync(dryRun);
        setRunning(null);
        if (!res.success || !res.report) {
            toast.error(res.error || "İşlem yapılamadı.");
            return;
        }
        setReport(res.report);
        setLastRunAt(res.report.finishedAt);
        setPreviewOk(dryRun && res.report.changed > 0 && !res.report.message.includes("durduruldu"));
        toast[res.report.applied || dryRun ? "success" : "warning"](res.report.message);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Ayarlar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="gogo-url">Gogo XML bağlantısı</Label>
                        <Input id="gogo-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.gogomotoaksesuar.com/output/..." />
                        <p className="text-xs text-gray-500">Size özel bağlantıdır; burada saklanır, kodda yer almaz.</p>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                        <div>
                            <p className="text-sm font-medium">Otomatik günlük güncelleme</p>
                            <p className="text-xs text-gray-500">Her gün 07:30&apos;da çalışır. Önce aşağıdan önizleyip bir kez elle uygulamanız önerilir.</p>
                        </div>
                        <Switch checked={enabled} onCheckedChange={setEnabled} />
                    </div>
                    <Button onClick={save} disabled={saving} className="bg-[#17457C] hover:bg-[#0f3460]">
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Kaydet
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Stok güncelle</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" onClick={() => run(true)} disabled={!!running || !initial.url && !url}>
                            {running === "preview" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                            Önizle (değiştirmez)
                        </Button>
                        <Button onClick={() => run(false)} disabled={!!running || !previewOk} className="bg-emerald-600 hover:bg-emerald-700">
                            {running === "apply" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                            Uygula
                        </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                        Bağlantıyı değiştirdiyseniz önce Kaydet&apos;e basın. &quot;Uygula&quot; önizlemeden sonra açılır. Son çalışma: {fmt(lastRunAt)}
                    </p>

                    {report && (
                        <div className="space-y-3">
                            <div className={`rounded-lg p-3 text-sm ${report.message.includes("durduruldu") || report.message.includes("bozuk") ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-800"}`}>
                                {report.message}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                                <Stat label="XML'deki ürün" value={report.xmlCount} />
                                <Stat label="Motor sitesi ürün" value={report.siteProducts} />
                                <Stat label="Kodu eşleşen" value={report.matched} />
                                <Stat label="Stoğu değişen" value={report.changed} />
                                <Stat label="0'a düşen" value={report.toZero} />
                            </div>
                            {report.sample.length > 0 && (
                                <div className="rounded-lg border overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 text-gray-500 text-xs">
                                            <tr>
                                                <th className="text-left p-2">Kod</th>
                                                <th className="text-left p-2">Ürün</th>
                                                <th className="text-right p-2">Şimdi</th>
                                                <th className="text-right p-2">Gogo</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {report.sample.map((c) => (
                                                <tr key={c.id} className="border-t">
                                                    <td className="p-2 font-mono text-xs">{c.sku}</td>
                                                    <td className="p-2">{c.name}</td>
                                                    <td className="p-2 text-right">{c.from}</td>
                                                    <td className={`p-2 text-right font-semibold ${c.to === 0 ? "text-red-600" : c.to > c.from ? "text-emerald-600" : ""}`}>{c.to}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {report.changed > report.sample.length && (
                                        <p className="p-2 text-xs text-gray-500 border-t">İlk {report.sample.length} değişiklik gösteriliyor (toplam {report.changed}).</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-lg font-bold">{value.toLocaleString("tr-TR")}</p>
        </div>
    );
}
