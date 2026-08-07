"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    User,
    ShoppingBag,
    MapPin,
    LogOut,
    FileQuestion,
    CreditCard,
    Heart,
    RefreshCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { useCartStore } from "@/stores/cart-store";

const sidebarItems = [
    {
        title: "Genel Bakış",
        href: "/account",
        icon: LayoutDashboard,
    },
    {
        title: "Profilim",
        href: "/account/profile",
        icon: User,
    },
    {
        title: "Siparişlerim",
        href: "/account/orders",
        icon: ShoppingBag,
    },
    {
        title: "Tekliflerim",
        href: "/account/quotes",
        icon: FileQuestion,
    },
    {
        title: "Favorilerim",
        href: "/account/wishlist",
        icon: Heart,
    },
    {
        title: "İade Taleplerim",
        href: "/account/returns",
        icon: RefreshCcw,
    },
    {
        title: "Adreslerim",
        href: "/account/addresses",
        icon: MapPin,
    },
    {
        title: "Finans / Bakiye",
        href: "/account/finance",
        icon: CreditCard,
    },
];

export default function AccountLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar */}
                <aside className="w-full md:w-64 shrink-0">
                    <div className="bg-white dark:bg-gray-900 rounded-lg border shadow-sm p-4">
                        <div className="mb-6 px-2">
                            <h2 className="font-semibold text-lg">Hesabım</h2>
                            <p className="text-sm text-gray-500">Hoş geldiniz</p>
                        </div>
                        <nav className="space-y-1">
                            {sidebarItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                            isActive
                                                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-200"
                                                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                                        )}
                                    >
                                        <item.icon className="h-4 w-4" />
                                        {item.title}
                                    </Link>
                                );
                            })}
                            <button
                                onClick={async () => {
                                    const { logout } = useCartStore.getState();
                                    logout();
                                    await signOut({ redirect: false });
                                    if (typeof window !== "undefined") {
                                        window.location.href = window.location.origin;
                                    }
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors mt-4 cursor-pointer"
                            >
                                <LogOut className="h-4 w-4" />
                                Çıkış Yap
                            </button>
                        </nav>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1">
                    <div className="bg-white dark:bg-gray-900 rounded-lg border shadow-sm p-6 min-h-[500px]">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
