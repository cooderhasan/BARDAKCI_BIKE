
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, RefreshCw, Download, Truck } from "lucide-react";
import { enqueueIdefixSync, syncOrdersFromIdefix, submitIdefixTrackingCode } from "./actions";

export function IdefixSyncButton() {
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await enqueueIdefixSync();
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
    } catch {
      toast.error("Bir hata olustu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
      <h3 className="font-semibold leading-none tracking-tight mb-4">
        Urun Esitleme
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Aktif Idefix urunlerini platformunuza gonderin (fast-listing veya stok/fiyat guncelleme).
      </p>
      <div className="space-y-4">
        <Button
          onClick={handleSync}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Isleniyor...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Urunleri Idefix'e Gonder
            </>
          )}
        </Button>
        <IdefixOrderSyncButton />
      </div>
    </div>
  );
}

function IdefixOrderSyncButton() {
  const [loading, setLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  const handleOrderSync = async () => {
    setLoading(true);
    try {
      const res = await syncOrdersFromIdefix(orderNumber ? orderNumber.trim() : undefined);
      if (res.success) {
        toast.success(res.message);
        if (orderNumber) setOrderNumber("");
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Bir hata olustu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 pt-4 border-t border-dashed border-purple-100">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-purple-700">
          Nokta Atisi Siparis Cek (Opsiyonel)
        </label>
        <input
          type="text"
          placeholder="Ornegin: 4623285863"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          disabled={loading}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 border-purple-200 focus-visible:ring-purple-500"
        />
      </div>
      <Button
        onClick={handleOrderSync}
        disabled={loading}
        variant="outline"
        className="w-full border-purple-200 text-purple-700 hover:bg-purple-50 shadow-sm transition-all duration-200"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Siparisler Cekiliyor...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            {orderNumber ? "Bu Siparisi Idefix'ten Cek" : "Siparisleri Idefix'ten Cek"}
          </>
        )}
      </Button>
    </div>
  );
}

// ==================== KARGO KODU BILDIRIMI ====================

export function IdefixTrackingPanel() {
  const [loading, setLoading] = useState(false);
  const [shipmentId, setShipmentId] = useState("");
  const [cargoCompany, setCargoCompany] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  const handleSubmit = async () => {
    if (!shipmentId || !cargoCompany || !trackingNumber) {
      toast.error("Tum alanlari doldurunuz.");
      return;
    }
    setLoading(true);
    try {
      const res = await submitIdefixTrackingCode(shipmentId, { cargoCompany, trackingNumber });
      if (res.success) {
        toast.success(res.message);
        setShipmentId("");
        setCargoCompany("");
        setTrackingNumber("");
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Bir hata olustu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <Truck className="w-4 h-4 text-purple-600" />
        <h3 className="font-semibold leading-none tracking-tight">
          Kargo Kodu Bildir
        </h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Kargoya verdiginiz Idefix siparisinin takip numarasini bildirin.
      </p>
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-purple-700">Shipment ID</label>
          <input
            type="text"
            placeholder="Idefix Shipment ID"
            value={shipmentId}
            onChange={(e) => setShipmentId(e.target.value)}
            disabled={loading}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50 border-purple-200"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-purple-700">Kargo Firmasi</label>
          <input
            type="text"
            placeholder="Yurtici, Aras, MNG..."
            value={cargoCompany}
            onChange={(e) => setCargoCompany(e.target.value)}
            disabled={loading}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50 border-purple-200"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-purple-700">Kargo Takip No</label>
          <input
            type="text"
            placeholder="1234567890"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            disabled={loading}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50 border-purple-200"
          />
        </div>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Bildiriliyor...
            </>
          ) : (
            <>
              <Truck className="w-4 h-4" />
              Kargo Kodunu Bildir
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
