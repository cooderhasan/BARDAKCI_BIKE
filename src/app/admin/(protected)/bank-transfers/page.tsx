"use client";

import { useState, useEffect } from "react";
import {
  getBankTransferNotifications,
  confirmBankTransfer,
  rejectBankTransfer,
} from "@/app/actions/bank-transfer";

export default function BankTransfersPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [filter, setFilter] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");

  const loadData = async () => {
    setLoading(true);
    const data = await getBankTransferNotifications(filter);
    setNotifications(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [filter]);

  const handleConfirm = async (id: string) => {
    if (!confirm("Havale onaylanacak ve sipariş durumu güncellenecek. Devam?")) return;
    const res = await confirmBankTransfer(id);
    setActionMsg(res.message);
    loadData();
    setTimeout(() => setActionMsg(""), 3000);
  };

  const handleReject = async (id: string) => {
    const note = prompt("Red notu (opsiyonel):");
    const res = await rejectBankTransfer(id, note || undefined);
    setActionMsg(res.message);
    loadData();
    setTimeout(() => setActionMsg(""), 3000);
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const formatPrice = (val: any) => {
    return Number(val).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      PENDING: { label: "Bekliyor", color: "bg-amber-500 text-white border-transparent" },
      CONFIRMED: { label: "Onaylandı", color: "bg-emerald-600 text-white border-transparent" },
      REJECTED: { label: "Reddedildi", color: "bg-rose-600 text-white border-transparent" },
    };
    const s = map[status] || map.PENDING;
    return <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full border shadow-sm ${s.color}`}>{s.label}</span>;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">💳 Havale Bildirimleri</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Müşterilerin havale/EFT bildirimlerini yönetin.
        </p>
      </div>

      {/* Filtreler */}
      <div className="flex gap-2">
        {[
          { value: "PENDING", label: "Bekleyenler" },
          { value: "CONFIRMED", label: "Onaylananlar" },
          { value: "REJECTED", label: "Reddedilenler" },
          { value: "ALL", label: "Tümü" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === f.value
                ? "bg-[#17457C] text-white shadow-sm"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Mesaj */}
      {actionMsg && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          {actionMsg}
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Yükleniyor...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
          <div className="text-4xl mb-3">📭</div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Bildirim bulunamadı</h3>
          <p className="text-sm text-gray-500 mt-1">Bu filtrede gösterilecek havale bildirimi yok.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n: any) => (
            <div
              key={n.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                {/* Sol */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 dark:text-white text-sm">
                      #{n.order?.orderNumber}
                    </span>
                    {statusBadge(n.status)}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <div>
                      <span className="font-medium text-gray-500">Gönderici:</span>{" "}
                      <span className="text-gray-900 dark:text-white">{n.senderName}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Banka:</span>{" "}
                      <span className="text-gray-900 dark:text-white">{n.bankName}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Tutar:</span>{" "}
                      <span className="font-bold text-gray-900 dark:text-white">{formatPrice(n.amount)}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Tarih:</span>{" "}
                      <span className="text-gray-900 dark:text-white">{formatDate(n.transferDate)}</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    <span className="font-medium">Sipariş Tutarı:</span>{" "}
                    <span className="font-bold">{formatPrice(n.order?.total)}</span>
                    {n.order?.user && (
                      <span className="ml-3">
                        <span className="font-medium">Müşteri:</span>{" "}
                        {n.order.user.companyName || n.order.user.email}
                      </span>
                    )}
                  </div>

                  {n.notes && (
                    <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                      <span className="font-medium">Not:</span> {n.notes}
                    </div>
                  )}

                  {n.adminNote && (
                    <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                      <span className="font-medium">Admin Notu:</span> {n.adminNote}
                    </div>
                  )}

                  <div className="text-[10px] text-gray-400">
                    Bildirim tarihi: {formatDate(n.createdAt)}
                  </div>
                </div>

                {/* Sağ - Aksiyonlar */}
                {n.status === "PENDING" && (
                  <div className="flex sm:flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleConfirm(n.id)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      ✓ Onayla
                    </button>
                    <button
                      onClick={() => handleReject(n.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      ✗ Reddet
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
