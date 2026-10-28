"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
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
    const navRef = useRef<HTMLElement>(null);

    // Telefonda menü yana kayan tek satır: açık sayfanın sekmesini görünür alana getir (sayfayı dikey kaydırmadan)
    useEffect(() => {
        const nav = navRef.current;
        const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
        if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
        nav.scrollLeft = active.offsetLeft - nav.clientWidth / 2 + active.clientWidth / 2;
    }, [pathname]);

    return (
        <div className="container mx-auto px-4 py-4 md:py-8">
            <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                {/* Menü: masaüstünde solda kart, telefonda yana kaydırılan sekme şeridi
                    (önceden telefonda 9 madde alt alta diziliyordu, içeriğe ulaşmak için uzun kaydırma gerekiyordu) */}
                <aside className="w-full md:w-64 shrink-0 min-w-0">
                    <div className="md:bg-white md:dark:bg-gray-900 md:rounded-lg md:border md:shadow-sm md:p-4">
                        <div className="hidden md:block mb-6 px-2">
                            <h2 className="font-semibold text-lg">Hesabım</h2>
                            <p className="text-sm text-gray-500">Hoş geldiniz</p>
                        </div>
                        <nav
                            ref={navRef}
                            className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:block md:space-y-1 md:overflow-visible"
                        >
                            {sidebarItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        aria-current={isActive ? "page" : undefined}
                                        className={cn(
                                            "shrink-0 flex items-center gap-2 md:gap-3 whitespace-nowrap px-3 py-2 text-sm font-medium rounded-full md:rounded-md border md:border-0 transition-colors",
                                            isActive
                                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-800"
                                                : "bg-white md:bg-transparent border-gray-200 text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
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
                                className="shrink-0 md:w-full flex items-center gap-2 md:gap-3 whitespace-nowrap px-3 py-2 text-sm font-medium text-red-600 bg-white md:bg-transparent border border-red-100 md:border-0 hover:bg-red-50 dark:bg-gray-900 dark:border-red-900/40 dark:hover:bg-red-900/20 rounded-full md:rounded-md transition-colors md:mt-4 cursor-pointer"
                            >
                                <LogOut className="h-4 w-4" />
                                Çıkış Yap
                            </button>
                        </nav>
                    </div>
                </aside>

                {/* Main Content */}
                {/* min-w-0: geniş tablo içerik alanını ekrandan taşırmasın */}
                <main className="flex-1 min-w-0">
                    <div className="bg-white dark:bg-gray-900 rounded-lg border shadow-sm p-4 md:p-6 md:min-h-[500px]">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
