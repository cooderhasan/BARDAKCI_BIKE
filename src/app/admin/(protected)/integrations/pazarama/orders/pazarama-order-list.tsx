"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  ShoppingCart,
  Package,
  MapPin,
  User,
  Calendar,
} from "lucide-react";
import { formatPrice } from "@/lib/helpers";

interface OrderItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  price: number;
  totalAmount: number;
}

interface Order {
  id: string;
  orderNumber: string;
  orderDate: string;
  status: string;
  totalAmount: number;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress: {
    address: string;
    city: string;
    district: string;
    postalCode?: string;
  };
  items: OrderItem[];
}

interface PazaramaOrderListProps {
  initialOrders: Order[];
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  "3": { label: "Sipariş Alındı", color: "bg-blue-100 text-blue-700 border-blue-200" },
  "5": { label: "Kargoya Verildi", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  "6": { label: "İptal Edildi", color: "bg-red-100 text-red-700 border-red-200" },
  "11": { label: "Teslim Edildi", color: "bg-green-100 text-green-700 border-green-200" },
  "12": { label: "Hazırlanıyor", color: "bg-orange-100 text-orange-700 border-orange-200" },
  "13": { label: "Tedarik Edilemedi", color: "bg-red-100 text-red-700 border-red-200" },
  "14": { label: "Teslim Edilemedi", color: "bg-red-100 text-red-700 border-red-200" },
  "7": { label: "İade Süreci", color: "bg-purple-100 text-purple-700 border-purple-200" },
  "8": { label: "İade Onaylandı", color: "bg-purple-100 text-purple-700 border-purple-200" },
  "9": { label: "İade Reddedildi", color: "bg-gray-100 text-gray-700 border-gray-200" },
  "10": { label: "İade Edildi", color: "bg-purple-100 text-purple-700 border-purple-200" },
};

function getStatusBadge(status: string) {
  const info = STATUS_MAP[status] || { label: `Durum: ${status}`, color: "bg-gray-100 text-gray-700 border-gray-200" };
  return <Badge className={info.color}>{info.label}</Badge>;
}

export function PazaramaOrderList({ initialOrders }: PazaramaOrderListProps) {
  const [orders] = useState(initialOrders);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  if (orders.length === 0) {
    return (
      <Card className="border-pink-200/60 dark:border-pink-900/40">
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-lg font-medium">Henüz Pazarama siparişi bulunmuyor</p>
            <p className="text-sm mt-1">Siparişler geldikçe burada görünecektir.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-pink-200/60 dark:border-pink-900/40">
      <CardHeader className="bg-pink-50/40 dark:bg-pink-950/20 pb-4">
        <CardTitle className="text-[#D81B60] dark:text-pink-400 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          Pazarama Siparişleri ({orders.length})
        </CardTitle>
        <CardDescription>
          Pazarama'dan gelen siparişler. Detay görmek için sipariş satırına tıklayın.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Sipariş No</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Müşteri</TableHead>
                <TableHead>Ürün Sayısı</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                return (
                  <>
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-pink-50/30"
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    >
                      <TableCell className="font-mono text-sm">#{order.orderNumber}</TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {new Date(order.orderDate).toLocaleDateString("tr-TR")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm">{order.customerName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {order.items.length} ürün
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-sm">
                        {formatPrice(order.totalAmount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${order.id}-detail`}>
                        <TableCell colSpan={6} className="bg-muted/30 p-4">
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1 mb-1">
                                  <MapPin className="w-3 h-3" />
                                  Teslimat Adresi
                                </h4>
                                <p className="text-sm">
                                  {order.deliveryAddress.address}
                                  <br />
                                  {order.deliveryAddress.district}/{order.deliveryAddress.city}
                                  {order.deliveryAddress.postalCode && ` ${order.deliveryAddress.postalCode}`}
                                </p>
                                {order.customerPhone && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Tel: {order.customerPhone}
                                  </p>
                                )}
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1 mb-1">
                                  <Package className="w-3 h-3" />
                                  Ürünler
                                </h4>
                                <div className="space-y-1">
                                  {order.items.map((item) => (
                                    <div key={item.productId} className="flex justify-between text-sm">
                                      <span>
                                        {item.productName}
                                        <span className="text-muted-foreground ml-1">x{item.quantity}</span>
                                      </span>
                                      <span className="font-medium">{formatPrice(item.totalAmount)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
