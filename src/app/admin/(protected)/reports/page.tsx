import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    BarChart3,
    TrendingUp,
    Package,
    Users,
    FolderTree,
    Boxes,
} from "lucide-react";

const reports = [
    {
        title: "Satış Özeti",
        description: "Günlük, haftalık ve aylık satış analizi",
        href: "/admin/reports/sales",
        icon: TrendingUp,
        color: "bg-blue-100 text-[#17457C]",
    },
    {
        title: "En Çok Satan Ürünler",
        description: "En popüler ürünlerin satış performansı",
        href: "/admin/reports/products",
        icon: Package,
        color: "bg-green-100 text-green-600",
    },
    {
        title: "Kategori Satışları",
        description: "Kategori bazlı satış dağılımı",
        href: "/admin/reports/categories",
        icon: FolderTree,
        color: "bg-purple-100 text-purple-600",
    },
    {
        title: "Bayi Performansı",
        description: "En aktif bayiler ve sipariş analizi",
        href: "/admin/reports/dealers",
        icon: Users,
        color: "bg-orange-100 text-orange-600",
    },
    {
        title: "Stok Durumu",
        description: "Tüm ürünlerin stok analizi",
        href: "/admin/reports/stock",
        icon: Boxes,
        color: "bg-red-100 text-red-600",
    },
];

export default function ReportsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="h-6 w-6 text-[#17457C]" />
                    Raporlar
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                    Satış ve performans analizleri
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {reports.map((report) => (
                    <Link key={report.href} href={report.href}>
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                            <CardHeader className="flex flex-row items-center gap-4">
                                <div className={`p-3 rounded-lg ${report.color}`}>
                                    <report.icon className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">{report.title}</CardTitle>
                                    <CardDescription>{report.description}</CardDescription>
                                </div>
                            </CardHeader>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
