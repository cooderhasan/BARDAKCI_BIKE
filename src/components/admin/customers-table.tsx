"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, Eye, UserCheck, UserPlus, Loader2, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { getUserStatusLabel, getUserStatusColor, formatDate, formatPrice } from "@/lib/helpers";
import { toast } from "sonner";
import { 
    updateCustomerStatus, 
    updateCustomerDiscountGroup, 
    createCustomer, 
    updateCustomerCreditLimit, 
    getCustomerTransactions, 
    addCustomerTransaction 
} from "@/app/admin/(protected)/customers/actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounce } from "@/hooks/use-debounce";

interface Customer {
    id: string;
    email: string;
    name: string | null;
    companyName: string | null;
    taxNumber: string | null;
    phone: string | null;
    city: string | null;
    role: string;
    status: string;
    createdAt: Date;
    creditLimit: number;
    currentDebt: number;
    availableLimit: number;
    discountGroup: {
        id: string;
        name: string;
        discountRate: number | { toNumber(): number };
    } | null;
    _count: {
        orders: number;
    };
}

interface CustomersTableProps {
    customers: Customer[];
    discountGroups: any[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
    };
}

export function CustomersTable({
    customers,
    discountGroups,
    pagination,
}: CustomersTableProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
    const debouncedSearch = useDebounce(searchInput, 500);
    const currentRole = searchParams.get("role") || "ALL";

    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Credit Limit State
    const [newCreditLimit, setNewCreditLimit] = useState("");
    const [limitLoading, setLimitLoading] = useState(false);

    // Transactions State
    const [transactions, setTransactions] = useState<any[]>([]);
    const [transactionsLoading, setTransactionsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("info");

    const createQueryString = useCallback(
        (params: Record<string, string | null>) => {
            const newParams = new URLSearchParams(searchParams.toString());
            Object.entries(params).forEach(([key, value]) => {
                if (value === null) {
                    newParams.delete(key);
                } else {
                    newParams.set(key, value);
                }
            });
            // Reset to page 1 on search or filter change
            if (params.search !== undefined || params.role !== undefined) {
                newParams.set("page", "1");
            }
            return newParams.toString();
        },
        [searchParams]
    );

    useEffect(() => {
        router.push(`${pathname}?${createQueryString({ search: debouncedSearch || null })}`);
    }, [debouncedSearch, pathname, router, createQueryString]);

    useEffect(() => {
        if (isOpen && activeTab === "finance" && selectedCustomer) {
            const fetchTransactions = async () => {
                setTransactionsLoading(true);
                try {
                    const data = await getCustomerTransactions(selectedCustomer.id);
                    setTransactions(data);
                } catch (error) {
                    console.error(error);
                    toast.error("Hareketler yüklenemedi");
                } finally {
                    setTransactionsLoading(false);
                }
            };
            fetchTransactions();
        }
    }, [isOpen, activeTab, selectedCustomer]);

    const handleRoleChange = (value: string) => {
        router.push(`${pathname}?${createQueryString({ role: value === "ALL" ? null : value })}`);
    };

    const handlePageChange = (page: number) => {
        router.push(`${pathname}?${createQueryString({ page: String(page) })}`);
    };

    // Add Customer State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [addLoading, setAddLoading] = useState(false);
    const [newCustomer, setNewCustomer] = useState({
        name: "",
        companyName: "",
        taxNumber: "",
        email: "",
        phone: "",
        password: "",
        discountGroupId: "",
    });

    const handleApprove = async (customerId: string) => {
        setLoading(true);
        try {
            await updateCustomerStatus(customerId, "APPROVED", "DEALER");
            toast.success("Müşteri onaylandı ve bayi olarak atandı.");
        } catch {
            toast.error("Bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async (customerId: string) => {
        setLoading(true);
        try {
            await updateCustomerStatus(customerId, "REJECTED");
            toast.success("Müşteri başvurusu reddedildi.");
        } catch {
            toast.error("Bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const [updatingCustomer, setUpdatingCustomer] = useState<string | null>(null);

    const handleDiscountGroupChange = async (
        customerId: string,
        discountGroupId: string
    ) => {
        setUpdatingCustomer(customerId);
        try {
            const result = await updateCustomerDiscountGroup(customerId, discountGroupId);
            if (result && result.success) {
                if (discountGroupId === "null") {
                    toast.success("Kullanıcı standart müşteriye çevrildi.");
                } else {
                    toast.success("İskonto grubu güncellendi ve kullanıcı bayiliğe yükseltildi.");
                }
            } else {
                toast.error(result?.error || "Güncelleme başarısız oldu.");
            }
        } catch (e) {
            console.error("Discount Group Update Error:", e);
            toast.error("Bir hata oluştu.");
        } finally {
            setUpdatingCustomer(null);
        }
    };

    const handleCreateCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddLoading(true);

        if (!newCustomer.name || !newCustomer.email || !newCustomer.password) {
            toast.error("Lütfen zorunlu alanları doldurun.");
            setAddLoading(false);
            return;
        }

        try {
            const result = await createCustomer(newCustomer);
            if (result.success) {
                toast.success("Müşteri başarıyla oluşturuldu.");
                setIsAddOpen(false);
                setNewCustomer({
                    name: "",
                    companyName: "",
                    taxNumber: "",
                    email: "",
                    phone: "",
                    password: "",
                    discountGroupId: "",
                });
            } else {
                toast.error(result.error || "Müşteri oluşturulurken bir hata oluştu.");
            }
        } catch {
            toast.error("Bir hata oluştu.");
        } finally {
            setAddLoading(false);
        }
    };

    // ... (existing handlers)

    const handleUpdateCreditLimit = async () => {
        if (!selectedCustomer) return;
        setLimitLoading(true);

        try {
            await updateCustomerCreditLimit(selectedCustomer.id, Number(newCreditLimit));
            toast.success("Kredi limiti güncellendi.");
            setNewCreditLimit("");
            // Optimistic update or refresh needed. RevalidatePath handles refresh usually.
        } catch {
            toast.error("Bir hata oluştu.");
        } finally {
            setLimitLoading(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-col sm:flex-row flex-1 gap-3 sm:gap-4 w-full md:max-w-xl">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Müşteri adı, mail veya telefon ile ara..."
                            className="pl-9"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                    </div>
                    <Select value={currentRole} onValueChange={handleRoleChange}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <Filter className="mr-2 h-4 w-4 text-gray-400" />
                            <SelectValue placeholder="Üyelik Tipi" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Tümü</SelectItem>
                            <SelectItem value="CUSTOMER">Bireysel Müşteri</SelectItem>
                            <SelectItem value="DEALER">Bayi</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex justify-end w-full md:w-auto">
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Yeni Müşteri Ekle
                            </Button>
                        </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <form onSubmit={handleCreateCustomer}>
                            <DialogHeader>
                                <DialogTitle>Yeni Müşteri Ekle</DialogTitle>
                                <DialogDescription>
                                    Müşteriyi manuel olarak ekleyin ve bayi grubunu seçin. Müşteri direkt onaylı olacaktır.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="add-name">Ad Soyad *</Label>
                                    <Input
                                        id="add-name"
                                        value={newCustomer.name}
                                        onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                        placeholder="Ad Soyad"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="companyName">Firma Adı</Label>
                                        <Input
                                            id="companyName"
                                            value={newCustomer.companyName}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, companyName: e.target.value })}
                                            placeholder="Firma Adı (Opsiyonel)"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="taxNumber">Vergi No / T.C.</Label>
                                        <Input
                                            id="taxNumber"
                                            value={newCustomer.taxNumber}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, taxNumber: e.target.value })}
                                            placeholder="VKN"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email">E-posta *</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={newCustomer.email}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                                            placeholder="ornek@email.com"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Telefon</Label>
                                        <Input
                                            id="phone"
                                            value={newCustomer.phone}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                            placeholder="0555..."
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Şifre *</Label>
                                    <Input
                                        id="password"
                                        type="text" // Admin görüyor, text olabilir veya password
                                        value={newCustomer.password}
                                        onChange={(e) => setNewCustomer({ ...newCustomer, password: e.target.value })}
                                        placeholder="Geçici şifre belirleyin"
                                        required
                                    />
                                    <p className="text-[10px] text-gray-500">Müşteriye iletmek üzere not alınız.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="discountGroup">İskonto Grubu</Label>
                                    <Select
                                        value={newCustomer.discountGroupId}
                                        onValueChange={(value) => setNewCustomer({ ...newCustomer, discountGroupId: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Grup Seçin" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {discountGroups.map((group) => (
                                                <SelectItem key={group.id} value={group.id}>
                                                    {group.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                                    İptal
                                </Button>
                                <Button type="submit" disabled={addLoading}>
                                    {addLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Kaydet
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
                </div>
            </div>

            <div className="rounded-lg border bg-white dark:bg-gray-800">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Firma</TableHead>
                            <TableHead>E-posta</TableHead>
                            <TableHead>Telefon</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead>İskonto Grubu</TableHead>
                            <TableHead>Sipariş</TableHead>
                            <TableHead className="text-right">İşlemler</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {customers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                    Henüz müşteri bulunmuyor.
                                </TableCell>
                            </TableRow>
                        ) : (
                            customers.map((customer) => (
                                <TableRow key={customer.id}>
                                    <TableCell>
                                        <div>
                                            <p className="font-medium">
                                                {customer.name || "-"}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {customer.companyName || (customer.role === "DEALER" ? "Firma Bilgisi Yok" : "Bireysel")}
                                            </p>
                                        </div>
                                    </TableCell>
                                    <TableCell>{customer.email}</TableCell>
                                    <TableCell>{customer.phone || "-"}</TableCell>
                                    <TableCell>
                                        <Badge className={getUserStatusColor(customer.status)}>
                                            {getUserStatusLabel(customer.status)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {customer.status === "APPROVED" ? (
                                            <Select
                                                value={customer.discountGroup?.id || ""}
                                                onValueChange={(value) =>
                                                    handleDiscountGroupChange(customer.id, value)
                                                }
                                                disabled={updatingCustomer === customer.id}
                                            >
                                                <SelectTrigger className="w-40">
                                                    <SelectValue placeholder={updatingCustomer === customer.id ? "Güncelleniyor..." : "Grup Seçin"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="null">
                                                        Standart Müşteri (İskonto Yok)
                                                    </SelectItem>
                                                    {discountGroups.map((group) => (
                                                        <SelectItem key={group.id} value={group.id}>
                                                            {group.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{customer._count.orders}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {customer.status === "PENDING" && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-green-600 hover:text-green-700"
                                                        onClick={() => handleApprove(customer.id)}
                                                        disabled={loading}
                                                    >
                                                        <Check className="h-4 w-4 mr-1" />
                                                        Onayla
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-red-600 hover:text-red-700"
                                                        onClick={() => handleReject(customer.id)}
                                                        disabled={loading}
                                                    >
                                                        <X className="h-4 w-4 mr-1" />
                                                        Reddet
                                                    </Button>
                                                </>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    setSelectedCustomer(customer);
                                                    setNewCreditLimit(String(customer.creditLimit || 0));
                                                    setIsOpen(true);
                                                }}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between px-2">
                <div className="text-sm text-gray-500">
                    Toplam <strong>{pagination.totalCount}</strong> müşteri bulundu.
                </div>
                <div className="flex items-center space-x-2">
                    <div className="text-sm font-medium mr-4">
                        Sayfa {pagination.currentPage} / {pagination.totalPages}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.currentPage - 1)}
                        disabled={pagination.currentPage <= 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.currentPage + 1)}
                        disabled={pagination.currentPage >= pagination.totalPages}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Customer Detail Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Müşteri Detayı</DialogTitle>
                        <DialogDescription>
                            {selectedCustomer?.companyName || selectedCustomer?.email}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto min-h-0 pr-2">
                        {selectedCustomer && (
                            <Tabs defaultValue="info" className="w-full" onValueChange={setActiveTab}>
                                <TabsList className="grid w-full grid-cols-2 sticky top-0 z-10">
                                    <TabsTrigger value="info">Genel Bilgiler</TabsTrigger>
                                    <TabsTrigger value="finance">Finans / Cari</TabsTrigger>
                                </TabsList>

                                <TabsContent value="info" className="space-y-4 pt-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-gray-500">Ad Soyad</p>
                                            <p className="font-medium">
                                                {selectedCustomer.name || "-"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Firma Adı</p>
                                            <p className="font-medium">
                                                {selectedCustomer.companyName || "-"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Vergi No</p>
                                            <p className="font-medium">
                                                {selectedCustomer.taxNumber || "-"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">E-posta</p>
                                            <p className="font-medium">{selectedCustomer.email}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Telefon</p>
                                            <p className="font-medium">{selectedCustomer.phone || "-"}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Şehir</p>
                                            <p className="font-medium">{selectedCustomer.city || "-"}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Kayıt Tarihi</p>
                                            <p className="font-medium">
                                                {formatDate(selectedCustomer.createdAt)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Durum</p>
                                            <Badge className={getUserStatusColor(selectedCustomer.status)}>
                                                {getUserStatusLabel(selectedCustomer.status)}
                                            </Badge>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Toplam Sipariş</p>
                                            <p className="font-medium">{selectedCustomer._count.orders}</p>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="finance" className="space-y-6 pt-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                                            <p className="text-sm text-gray-500 mb-1">Toplam Kredi Limiti</p>
                                            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatPrice(selectedCustomer.creditLimit)}</p>
                                        </div>
                                        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-lg">
                                            <p className="text-sm text-red-500 mb-1">Güncel Borç</p>
                                            <p className="text-lg font-bold text-red-700 dark:text-red-400">{formatPrice(selectedCustomer.currentDebt)}</p>
                                        </div>
                                        <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg">
                                            <p className="text-sm text-green-500 mb-1">Kullanılabilir Limit</p>
                                            <p className="text-lg font-bold text-green-700 dark:text-green-400">{formatPrice(selectedCustomer.availableLimit)}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4 border-t pt-4">
                                        <h3 className="text-sm font-semibold">Limit Güncelleme</h3>
                                        <div className="flex gap-4 items-end">
                                            <div className="space-y-2 flex-1">
                                                <Label htmlFor="creditLimit">Kredi Limiti (TL)</Label>
                                                <Input
                                                    id="creditLimit"
                                                    type="number"
                                                    value={newCreditLimit}
                                                    onChange={(e) => setNewCreditLimit(e.target.value)}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <Button
                                                onClick={handleUpdateCreditLimit}
                                                disabled={limitLoading || !newCreditLimit}
                                            >
                                                {limitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Güncelle
                                            </Button>
                                        </div>
                                    </div>


                                    <div className="space-y-4 border-t pt-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-semibold">Manuel İşlem / Bakiye Ekle</h3>
                                        </div>
                                        <AddTransactionForm
                                            customerId={selectedCustomer.id}
                                            onSuccess={() => {
                                                toast.success("İşlem eklendi");
                                                // Trigger refresh of transactions
                                                const fetchTransactions = async () => {
                                                    const data = await getCustomerTransactions(selectedCustomer.id);
                                                    setTransactions(data);
                                                };
                                                fetchTransactions();
                                            }}
                                        />
                                    </div>

                                    <div className="space-y-4 border-t pt-4">
                                        <h3 className="text-sm font-semibold">Son Hesap Hareketleri</h3>
                                        <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[100px]">Tarih</TableHead>
                                                        <TableHead>İşlem</TableHead>
                                                        <TableHead>Açıklama</TableHead>
                                                        <TableHead className="text-right">Tutar</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {transactionsLoading ? (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="text-center py-4">
                                                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : transactions.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                                                                Kayıt bulunamadı.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        transactions.map((t: any) => (
                                                            <TableRow key={t.id}>
                                                                <TableCell className="text-xs">{formatDate(t.createdAt)}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className={t.type === "DEBIT" ? "text-red-600 bg-red-50 border-red-200" : "text-green-600 bg-green-50 border-green-200"}>
                                                                        {t.type === "DEBIT" ? "Borç" : "Alacak"}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-xs">
                                                                    <div>{t.description}</div>
                                                                    {t.documentNo && <div className="text-gray-400">Belge: {t.documentNo}</div>}
                                                                </TableCell>
                                                                <TableCell className={`text-right text-xs font-mono font-medium ${t.type === "DEBIT" ? "text-red-600" : "text-green-600"}`}>
                                                                    {t.type === "DEBIT" ? "-" : "+"}{formatPrice(t.amount)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)}>
                            Kapat
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}

function AddTransactionForm({ customerId, onSuccess }: { customerId: string, onSuccess: () => void }) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState({
        type: "DEBIT" as "DEBIT" | "CREDIT",
        processType: "OPENING_BALANCE" as "OPENING_BALANCE" | "ADJUSTMENT" | "PAYMENT",
        amount: "",
        description: "",
        documentNo: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!data.amount) return;
        setLoading(true);
        try {
            await addCustomerTransaction({
                userId: customerId,
                type: data.type,
                processType: data.processType,
                amount: Number(data.amount),
                description: data.description,
                documentNo: data.documentNo
            });
            setData({ ...data, amount: "", description: "", documentNo: "" });
            onSuccess();
        } catch (error) {
            toast.error("İşlem eklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="grid gap-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>İşlem Türü</Label>
                    <Select value={data.type} onValueChange={(v: any) => setData({ ...data, type: v })}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="DEBIT">Borç Ekle (Bakiye Artır)</SelectItem>
                            <SelectItem value="CREDIT">Alacak Ekle (Ödeme Düş)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Kategori</Label>
                    <Select value={data.processType} onValueChange={(v: any) => setData({ ...data, processType: v })}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="OPENING_BALANCE">Açılış Bakiyesi / Devir</SelectItem>
                            <SelectItem value="ADJUSTMENT">Manuel Düzeltme</SelectItem>
                            <SelectItem value="PAYMENT">Tahsilat / Ödeme</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Tutar (TL)</Label>
                    <Input
                        type="number"
                        placeholder="0.00"
                        value={data.amount}
                        onChange={e => setData({ ...data, amount: e.target.value })}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label>Belge No (Opsiyonel)</Label>
                    <Input
                        placeholder="Evrak No"
                        value={data.documentNo}
                        onChange={e => setData({ ...data, documentNo: e.target.value })}
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label>Açıklama</Label>
                <Input
                    placeholder="İşlem açıklaması..."
                    value={data.description}
                    onChange={e => setData({ ...data, description: e.target.value })}
                    required
                />
            </div>
            <div className="flex justify-end">
                <Button type="submit" disabled={loading} size="sm">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    İşlemi Kaydet
                </Button>
            </div>
        </form>
    );
}
