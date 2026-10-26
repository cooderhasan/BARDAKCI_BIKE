"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Users,
    Package,
    ShoppingCart,
    ShoppingBasket,
    Settings,
    ShieldCheck,
    Tag,
    FileText,
    ChevronLeft,
    ChevronDown,
    Award,
    AlertTriangle,
    BarChart3,
    FileQuestion,
    Mail,
    Scale,
    Truck,
    Image as LucideImage,
    GalleryHorizontal,
    Search,
    RefreshCcw,
    Star,
    Brain,
    Store,
    Landmark,
    Percent,
    Receipt,
    Layers,
    Rss,
    ShoppingBag,
    MessageSquareQuote,
    Newspaper,
    ArrowUpRight,
    X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

type MenuItem = {
    title: string;
    href: string;
    icon?: any;
    /** Pazaryerleri ikon yerine kısa renkli rozetle gösterilir */
    badge?: { text: string; className: string };
};

type MenuGroup = {
    id: string;
    title: string;
    /** Kullanıcı daha önce açıp kapatmadıysa başlangıçta açık mı */
    defaultOpen: boolean;
    items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
    {
        id: "genel",
        title: "Genel",
        defaultOpen: true,
        items: [
            { title: "Genel Bakış", href: "/admin", icon: LayoutDashboard },
            { title: "Raporlar", href: "/admin/reports", icon: BarChart3 },
        ],
    },
    {
        id: "satis",
        title: "Satış & Müşteri",
        defaultOpen: true,
        items: [
            { title: "Siparişler", href: "/admin/orders", icon: ShoppingCart },
            { title: "Sepette Bekleyenler", href: "/admin/reports/abandoned-carts", icon: ShoppingBasket },
            { title: "Müşteriler", href: "/admin/customers", icon: Users },
            { title: "Havale Bildirimleri", href: "/admin/bank-transfers", icon: Landmark },
            { title: "İade Talepleri", href: "/admin/returns", icon: RefreshCcw },
            { title: "Değerlendirmeler", href: "/admin/reviews", icon: Star },
            { title: "Teklifler", href: "/admin/quotes", icon: MessageSquareQuote },
            { title: "Mesajlar", href: "/admin/messages", icon: Mail },
            { title: "Stok Uyarı", href: "/admin/stock-alerts", icon: AlertTriangle },
        ],
    },
    {
        id: "katalog",
        title: "Katalog",
        defaultOpen: true,
        items: [
            { title: "Ürünler", href: "/admin/products", icon: Package },
            { title: "Kategoriler", href: "/admin/categories", icon: Tag },
            { title: "Markalar", href: "/admin/brands", icon: Award },
            { title: "Sliderlar", href: "/admin/sliders", icon: GalleryHorizontal },
            { title: "Bannerlar", href: "/admin/banners", icon: LucideImage },
            { title: "Blog Yazıları", href: "/admin/blog", icon: Newspaper },
        ],
    },
    {
        id: "pazaryerleri",
        title: "Pazaryerleri",
        defaultOpen: true,
        items: [
            { title: "Trendyol", href: "/admin/integrations/trendyol", badge: { text: "TY", className: "bg-orange-500" } },
            { title: "Hepsiburada", href: "/admin/integrations/hepsiburada", badge: { text: "HB", className: "bg-amber-500" } },
            { title: "N11", href: "/admin/integrations/n11", badge: { text: "N11", className: "bg-violet-600" } },
            { title: "Idefix", href: "/admin/integrations/idefix", badge: { text: "İD", className: "bg-sky-600" } },
            { title: "Pazarama", href: "/admin/integrations/pazarama", badge: { text: "PZ", className: "bg-blue-600" } },
            { title: "ePttAVM", href: "/admin/integrations/pttavm", badge: { text: "PTT", className: "bg-yellow-500" } },
            { title: "Çiçeksepeti", href: "/admin/integrations/ciceksepeti", badge: { text: "ÇS", className: "bg-emerald-600" } },
        ],
    },
    {
        id: "entegrasyon",
        title: "Entegrasyonlar",
        defaultOpen: false,
        items: [
            { title: "Toplu İşlemler", href: "/admin/bulk-updates", icon: Layers },
            { title: "Gogo Stok (XML)", href: "/admin/integrations/gogo", icon: Rss },
            { title: "Google Merchant", href: "/admin/integrations/google", icon: ShoppingBag },
            { title: "Gemini AI", href: "/admin/integrations/gemini", icon: Brain },
            { title: "Yurtiçi Kargo", href: "/admin/integrations/yurtici", icon: Truck },
            { title: "NES E-Fatura", href: "/admin/integrations/nes-efatura", icon: Receipt },
            { title: "Trendyol e-Faturam", href: "/admin/integrations/trendyol-efaturam", icon: FileText },
        ],
    },
    {
        id: "yapilandirma",
        title: "Yapılandırma",
        defaultOpen: false,
        items: [
            { title: "Mağaza Ayarları", href: "/admin/store-settings", icon: Store },
            { title: "Ayarlar", href: "/admin/settings", icon: Settings },
            { title: "Güvenlik (2FA)", href: "/admin/security", icon: ShieldCheck },
            { title: "İskonto Grupları", href: "/admin/discount-groups", icon: Percent },
            { title: "Politikalar", href: "/admin/policies", icon: Scale },
            { title: "SSS Yönetimi", href: "/admin/faqs", icon: FileQuestion },
        ],
    },
];

// Menü tercihleri yalnızca bu tarayıcıda tutulur (sunucuya istek yok)
const GROUPS_KEY = "admin-sidebar-groups";
const COLLAPSED_KEY = "admin-sidebar-collapsed";

const allHrefs = menuGroups.flatMap((g) => g.items.map((i) => i.href));

/** En uzun eşleşen menü adresi aktif sayılır (Sepette Bekleyenler açıkken Raporlar da yanmasın) */
function getActiveHref(pathname: string) {
    let best = "";
    for (const href of allHrefs) {
        const match = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(href + "/");
        if (match && href.length > best.length) best = href;
    }
    return best;
}

export function AdminSidebarModern({ settings }: { settings?: any }) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    const activeHref = getActiveHref(pathname);

    useEffect(() => {
        const handleToggle = () => setMobileOpen(true);
        window.addEventListener('toggle-admin-sidebar', handleToggle);
        return () => window.removeEventListener('toggle-admin-sidebar', handleToggle);
    }, []);

    // Kayıtlı tercihleri yükle
    useEffect(() => {
        try {
            const saved = localStorage.getItem(GROUPS_KEY);
            if (saved) setOpenGroups(JSON.parse(saved));
            if (localStorage.getItem(COLLAPSED_KEY) === "1") setCollapsed(true);
        } catch { }
    }, []);

    // Daraltılmış menüde içerik alanı da daralsın (globals.css: html[data-admin-sidebar])
    useEffect(() => {
        const root = document.documentElement;
        if (collapsed) root.dataset.adminSidebar = "collapsed";
        else delete root.dataset.adminSidebar;
        return () => { delete root.dataset.adminSidebar; };
    }, [collapsed]);

    const toggleCollapsed = () => {
        const next = !collapsed;
        setCollapsed(next);
        try { localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0"); } catch { }
    };

    const isGroupOpen = (group: MenuGroup) => {
        // Aktif sayfanın grubu her zaman açık
        if (group.items.some((i) => i.href === activeHref)) return true;
        return openGroups[group.id] ?? group.defaultOpen;
    };

    const toggleGroup = (group: MenuGroup) => {
        const next = { ...openGroups, [group.id]: !isGroupOpen(group) };
        setOpenGroups(next);
        try { localStorage.setItem(GROUPS_KEY, JSON.stringify(next)); } catch { }
    };

    const logoUrl = settings?.logoUrl;
    const siteName = settings?.siteName || "Yönetim";

    const q = searchQuery.trim().toLocaleLowerCase("tr");
    const filteredGroups = q
        ? menuGroups.map(group => ({
            ...group,
            items: group.items.filter(item => item.title.toLocaleLowerCase("tr").includes(q))
        })).filter(group => group.items.length > 0)
        : menuGroups;

    const renderIcon = (item: MenuItem, isActive: boolean) => {
        if (item.badge) {
            return (
                <span
                    className={cn(
                        "flex h-[22px] min-w-[22px] px-1 items-center justify-center rounded-md text-[9px] font-bold leading-none text-white shrink-0",
                        item.badge.className,
                        !isActive && "opacity-85 group-hover:opacity-100"
                    )}
                >
                    {item.badge.text}
                </span>
            );
        }
        const Icon = item.icon;
        return (
            <span className="flex h-[22px] w-[22px] items-center justify-center shrink-0">
                <Icon
                    className={cn(
                        "h-[18px] w-[18px]",
                        isActive
                            ? "text-[#17457C] dark:text-blue-400"
                            : "text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300"
                    )}
                    strokeWidth={isActive ? 2.25 : 1.75}
                />
            </span>
        );
    };

    return (
        <>
            {/* Mobile overlay */}
            <div
                className={cn(
                    "fixed inset-0 z-40 bg-gray-900/50 lg:hidden transition-opacity duration-200",
                    mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={() => setMobileOpen(false)}
            />

            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex flex-col print:hidden",
                    "bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 shadow-xl lg:shadow-none",
                    "transition-[width,transform] duration-200",
                    collapsed ? "lg:w-[80px] w-72" : "w-72",
                    mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                )}
            >
                {/* Logo */}
                <div className={cn(
                    "relative flex items-center shrink-0 border-b border-gray-100 dark:border-gray-800",
                    collapsed ? "lg:justify-center h-16 px-4 lg:px-2" : "h-16 px-4"
                )}>
                    <Link
                        href="/admin"
                        onClick={() => setMobileOpen(false)}
                        className={cn("relative block h-10", collapsed ? "w-full lg:w-11" : "w-full mr-8")}
                        title={siteName}
                    >
                        {logoUrl ? (
                            <Image
                                src={logoUrl}
                                alt={siteName}
                                fill
                                sizes="240px"
                                className={cn("object-contain", collapsed ? "object-left lg:object-center" : "object-left")}
                                priority
                            />
                        ) : (
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#17457C] text-white text-xs font-black">
                                {siteName.substring(0, 3).toUpperCase()}
                            </span>
                        )}
                    </Link>

                    {/* Mobilde kapat */}
                    <button
                        type="button"
                        onClick={() => setMobileOpen(false)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        aria-label="Menüyü kapat"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Arama (daraltılmış masaüstü görünümde gizli) */}
                <div className={cn("px-3 pt-3 pb-1 shrink-0", collapsed && "lg:hidden")}>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Menüde ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 text-sm bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-lg focus:bg-white dark:focus:bg-gray-900"
                        />
                    </div>
                </div>

                {/* Menü */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 custom-scrollbar">
                    {filteredGroups.length === 0 && (
                        <p className="px-3 py-6 text-center text-sm text-gray-400">Sonuç yok</p>
                    )}
                    {filteredGroups.map((group, groupIndex) => {
                        // Aramada ve daraltılmış görünümde tüm gruplar açık
                        const open = q || collapsed ? true : isGroupOpen(group);
                        return (
                            <div
                                key={group.id}
                                className={cn(
                                    groupIndex > 0 && "mt-3",
                                    collapsed && groupIndex > 0 && "lg:mt-2 lg:pt-2 lg:border-t lg:border-gray-100 lg:dark:border-gray-800"
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => toggleGroup(group)}
                                    className={cn(
                                        "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300",
                                        collapsed && "lg:hidden"
                                    )}
                                    aria-expanded={open}
                                >
                                    {group.title}
                                    {!q && (
                                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", !open && "-rotate-90")} />
                                    )}
                                </button>

                                {open && (
                                    <div className="mt-0.5 space-y-0.5">
                                        {group.items.map((item) => {
                                            const isActive = item.href === activeHref;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={() => setMobileOpen(false)}
                                                    title={collapsed ? item.title : undefined}
                                                    aria-current={isActive ? "page" : undefined}
                                                    className={cn(
                                                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                                        collapsed && "lg:justify-center lg:px-0",
                                                        isActive
                                                            ? "bg-[#17457C]/[0.07] text-[#17457C] font-semibold dark:bg-blue-500/10 dark:text-blue-300"
                                                            : "text-gray-600 font-medium hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/70 dark:hover:text-gray-100"
                                                    )}
                                                >
                                                    {isActive && (
                                                        <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#17457C] dark:bg-blue-400" />
                                                    )}
                                                    {renderIcon(item, isActive)}
                                                    <span className={cn("truncate", collapsed && "lg:hidden")}>{item.title}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Alt kısım */}
                <div className={cn(
                    "shrink-0 border-t border-gray-100 dark:border-gray-800 p-3 flex items-center gap-2",
                    collapsed && "lg:flex-col"
                )}>
                    <Link
                        href="/"
                        target="_blank"
                        className={cn(
                            "flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-colors",
                            collapsed && "lg:justify-center lg:px-0 lg:w-full"
                        )}
                        title="Mağazayı yeni sekmede aç"
                    >
                        <Store className="h-[18px] w-[18px] text-gray-400 shrink-0" strokeWidth={1.75} />
                        <span className={cn("truncate", collapsed && "lg:hidden")}>Mağazayı Gör</span>
                        <ArrowUpRight className={cn("ml-auto h-3.5 w-3.5 text-gray-400", collapsed && "lg:hidden")} />
                    </Link>
                    <button
                        type="button"
                        onClick={toggleCollapsed}
                        className="hidden lg:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                        title={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
                        aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
                    >
                        <ChevronLeft className={cn("h-4 w-4 transition-transform duration-200", collapsed && "rotate-180")} />
                    </button>
                </div>
            </aside>
        </>
    );
}
