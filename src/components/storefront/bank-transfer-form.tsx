"use client";

import { useState } from "react";
import { submitBankTransferNotification } from "@/app/actions/bank-transfer";
import { toast } from "sonner";

interface BankTransferFormProps {
  orderId: string;
  orderTotal: number;
  bankInfo?: {
    bankName?: string;
    iban?: string;
    accountHolder?: string;
  };
}

const BANKS = [
  "Ziraat Bankası",
  "Halkbank",
  "Vakıfbank",
  "İş Bankası",
  "Garanti BBVA",
  "Akbank",
  "Yapı Kredi",
  "QNB Finansbank",
  "Denizbank",
  "TEB",
  "ING Bank",
  "Şekerbank",
  "Kuveyt Türk",
  "Türkiye Finans",
  "Diğer",
];

export function BankTransferForm({ orderId, orderTotal, bankInfo }: BankTransferFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    senderName: "",
    bankName: "",
    amount: orderTotal.toString(),
    transferDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!formData.senderName || !formData.bankName || !formData.amount) {
      toast.error("Lütfen zorunlu alanları doldurun.");
      return;
    }
    
    setLoading(true);
    try {
      const res = await submitBankTransferNotification({
        orderId,
        senderName: formData.senderName,
        bankName: formData.bankName,
        amount: parseFloat(formData.amount),
        transferDate: formData.transferDate,
        notes: formData.notes || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        setOpen(false);
      } else {
        toast.error(res.message || "Bir hata oluştu.");
      }
    } catch (error: any) {
      toast.error("İşlem sırasında bir hata oluştu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Banka Bilgileri */}
      {bankInfo && (bankInfo.iban || bankInfo.bankName) && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 text-sm">🏦 Banka Hesap Bilgileri</h3>
          <div className="space-y-1 text-sm text-blue-700 dark:text-[#17457C]">
            {bankInfo.bankName && <p><span className="font-medium">Banka:</span> {bankInfo.bankName}</p>}
            {bankInfo.accountHolder && <p><span className="font-medium">Hesap Sahibi:</span> {bankInfo.accountHolder}</p>}
            {bankInfo.iban && (
              <p className="font-mono text-xs bg-white dark:bg-blue-900/40 px-2 py-1 rounded mt-1 select-all">
                {bankInfo.iban}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Sonuç mesajı artık toast ile gösteriliyor */}

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors shadow-sm text-sm"
        >
          💳 Havale Yaptım, Bildir
        </button>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Havale Bildirim Formu</h3>
          
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Gönderici Adı / Firma <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.senderName}
              onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
              placeholder="Havaleyi gönderen kişi/firma adı"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Havale Yapılan Banka <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.bankName}
              onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Seçin</option>
              {BANKS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Tutar (₺) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tarih</label>
              <input
                type="date"
                value={formData.transferDate}
                onChange={(e) => setFormData({ ...formData, transferDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Not (opsiyonel)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Ek bilgi varsa yazabilirsiniz"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm"
            >
              {loading ? "Gönderiliyor..." : "Bildirimi Gönder"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm"
            >
              İptal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
