"use client";

import { useState, useRef, useEffect, useMemo } from "react";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShoppingCart, User, Menu, LogOut, Package, Settings, LayoutDashboard, X, Phone, Zap, ChevronDown, Home, Car, Truck, Building2, Mail, Info, Cog, Plus, Minus, ChevronRight } from "lucide-react";



import { signOut } from "next-auth/react";
import { useCartStore } from "@/stores/cart-store";
import type { UserRole, UserStatus } from "@prisma/client";
import { SearchInput } from "./search-input";
import { CategoryMenu } from "./category-menu";

interface Category {
    id: string;
    name: string;
    slug: string;
    parentId?: string | null;
    isInHeader?: boolean;
    headerOrder?: number;
    menuImageUrl?: string | null;
    imageUrl?: string | null;
    children?: Category[];
}

interface StorefrontHeaderProps {
    user?: {
        id: string;
        email: string;
        role: UserRole;
        status: UserStatus;
        companyName?: string | null;
        discountRate?: number;
    } | null;
    logoUrl?: string;
    siteName?: string;
    categories?: Category[];
    phone?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    twitterUrl?: string;
    linkedinUrl?: string;
    sidebarCategories?: Category[];
}

export function StorefrontHeader({ user, logoUrl, siteName, categories = [], sidebarCategories = [], phone, facebookUrl, instagramUrl, twitterUrl, linkedinUrl }: StorefrontHeaderProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const items = useCartStore((state) => state.items);
    const clearCart = useCartStore((state) => state.clearCart);
    const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

    // Auto-close mobile menu on navigation
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname, searchParams]);
    const [mounted, setMounted] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleMouseEnter = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsDropdownOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsDropdownOpen(false);
        }, 300);
    };

    const isAdmin = user?.role === "ADMIN" || user?.role === "OPERATOR";
    const isDealer = user?.role === "DEALER" && user?.status === "APPROVED";

    const categoryTree = useMemo(() => {
        return categories
            .filter(c => c.name !== "Root" && c.name !== "Home")
            .map(c => ({
                ...c,
                children: (c.children || []) as Category[]
            }));
    }, [categories]);

    // Use sidebar categories for mobile menu (all 11 categories with subcategories)
    const mobileCategoryTree = useMemo(() => {
        const source = sidebarCategories.length > 0 ? sidebarCategories : categories;
        return source
            .filter(c => c.name !== "Root" && c.name !== "Home")
            .map(c => ({
                ...c,
                children: (c.children || []) as Category[]
            }));
    }, [sidebarCategories, categories]);

    return (
        <header className="sticky top-0 z-50 w-full bg-white/95 supports-[backdrop-filter]:bg-white/80 dark:bg-gray-900/95 supports-[backdrop-filter]:dark:bg-gray-900/80 backdrop-blur-md shadow-sm border-b border-gray-200/50 dark:border-gray-800/50 transition-all duration-300">

            {/* Top Row: Logo, Search, User Actions */}
            <div className="border-b dark:border-gray-800/50 py-2">
                <div className="container mx-auto px-4 max-w-7xl">
                    <div className="flex h-16 lg:h-24 items-center justify-between gap-2 lg:gap-6">
                        {/* Left: Logo + Phone */}
                        <div className="flex items-center gap-2 md:gap-4 shrink-0">
                            {/* Logo */}
                            <Link href="/" className="flex items-center gap-2 group">
                                {logoUrl ? (
                                    <div className="relative h-10 lg:h-16 w-auto aspect-[4/1] transition-transform duration-300 group-hover:scale-105">
                                        <Image
                                            src={logoUrl}
                                            alt={siteName || "Logo"}
                                            fill
                                            className="object-contain"
                                            sizes="(max-width: 768px) 150px, 240px"
                                            priority
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 transition-transform duration-300 group-hover:scale-105">
                                        <div className="w-10 h-10 md:w-14 md:h-14 bg-[#17457C] rounded-xl flex items-center justify-center transform -rotate-3 shadow-lg group-hover:rotate-0 transition-transform">
                                            <span className="text-white font-extrabold text-xl md:text-3xl">B</span>
                                        </div>
                                        <div className="flex flex-col leading-none">
                                            <span className="font-black text-xl md:text-3xl text-gray-900 dark:text-white tracking-tight uppercase">
                                                BARDAKCI
                                            </span>
                                            <span className="font-bold text-[10px] md:text-base text-[#17457C] tracking-widest uppercase">
                                                BIKE
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </Link>

                            {/* Call Center (Desktop) - Next to Logo */}
                            {phone && (
                                <a
                                    href={`tel:${phone.replace(/\s/g, '')}`}
                                    className="hidden lg:flex items-center gap-3 text-gray-600 hover:text-[#17457C] hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all duration-200 px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-800 ml-4 shadow-2xs"
                                >
                                    <div className="w-9 h-9 bg-green-50 dark:bg-green-950/40 rounded-full flex items-center justify-center shrink-0">
                                        <Phone className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider leading-none mb-1">Çağrı Merkezi</span>
                                        <span className="text-sm font-extrabold text-gray-900 dark:text-white leading-none">{phone}</span>
                                    </div>
                                </a>
                            )}
                        </div>

                        {/* Center: Search Bar */}
                        <div className="flex-1 max-w-3xl lg:max-w-4xl mx-auto hidden sm:block px-2 lg:px-8">
                            <SearchInput />
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center gap-2 md:gap-6 shrink-0">

                            {/* User Panel */}
                            <div
                                onMouseEnter={handleMouseEnter}
                                onMouseLeave={handleMouseLeave}
                                className="relative"
                            >
                                {!mounted ? (
                                    <button className="flex items-center gap-1 md:gap-3 text-gray-700 hover:text-[#17457C] transition-colors px-1.5 md:px-3 py-1.5 md:py-2 rounded-lg hover:bg-gray-100">
                                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                            <User className="h-5 w-5" />
                                        </div>
                                        <div className="hidden sm:flex flex-col items-start">
                                            <span className="text-[10px] text-gray-500">Kullanıcı</span>
                                            <span className="text-sm font-semibold">Giriş Yap</span>
                                        </div>
                                    </button>
                                ) : (
                                    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen} modal={false}>
                                        <DropdownMenuTrigger asChild>
                                            <button className="flex items-center gap-1 md:gap-3 text-gray-700 hover:text-[#17457C] transition-colors px-1.5 md:px-3 py-1.5 md:py-2 rounded-lg hover:bg-gray-100 outline-none">
                                                <div className={`w-10 h-10 ${user ? 'bg-[#17457C]/10' : 'bg-gray-100'} rounded-full flex items-center justify-center`}>
                                                    <User className={`h-5 w-5 ${user ? 'text-[#17457C]' : ''}`} />
                                                </div>
                                                <div className="hidden sm:flex flex-col items-start">
                                                    <span className="text-[10px] text-gray-500">Kullanıcı</span>
                                                    <span className="text-sm font-semibold">
                                                        {user ? "Hesabım" : "Giriş Yap"}
                                                    </span>
                                                </div>
                                            </button>
                                        </DropdownMenuTrigger>

                                        {!user ? (
                                            <DropdownMenuContent align="end" className="w-[280px] p-4">
                                                <div className="flex flex-col gap-3">
                                                    <Link href="/login" className="w-full">
                                                        <Button variant="default" className="w-full">
                                                            Giriş Yap
                                                        </Button>
                                                    </Link>
                                                    <Link href="/register" className="w-full">
                                                        <Button variant="outline" className="w-full">
                                                            Üye Ol
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </DropdownMenuContent>
                                        ) : (
                                            <DropdownMenuContent align="end" className="w-56">
                                                <DropdownMenuLabel>
                                                    <div className="flex flex-col space-y-1">
                                                        <p className="text-sm font-medium">
                                                            {user.companyName || "Hoşgeldiniz"}
                                                        </p>
                                                        <p className="text-xs text-gray-500">{user.email}</p>
                                                    </div>
                                                </DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem asChild>
                                                    <Link href="/account">
                                                        <LayoutDashboard className="mr-2 h-4 w-4" />
                                                        Hesabım
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                {isDealer && (
                                                    <>
                                                        <DropdownMenuItem asChild>
                                                            <Link href="/account/orders">
                                                                <Package className="mr-2 h-4 w-4" />
                                                                Siparişlerim
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                    </>
                                                )}
                                                {isAdmin && (
                                                    <>
                                                        <DropdownMenuItem asChild>
                                                            <Link href="/admin">
                                                                <Settings className="mr-2 h-4 w-4" />
                                                                Admin Panel
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                    </>
                                                )}
                                                <DropdownMenuItem
                                                    className="text-red-600"
                                                    onClick={() => {
                                                        const { logout } = useCartStore.getState();
                                                        logout();
                                                        signOut({ callbackUrl: "/" });
                                                    }}
                                                >
                                                    <LogOut className="mr-2 h-4 w-4" />
                                                    Çıkış Yap
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        )}
                                    </DropdownMenu>
                                )}
                            </div>

                            {/* Cart - Visible for everyone */}
                            <Link href="/cart" className={cn(
                                "flex items-center gap-1 md:gap-3 text-gray-700 hover:text-[#17457C] transition-colors px-1.5 md:px-3 py-1.5 md:py-2 rounded-lg hover:bg-gray-100",
                                user && "border-l border-gray-100 dark:border-gray-800 ml-1 pl-2 md:pl-4"
                            )}>
                                <div className="relative">
                                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                                        <ShoppingCart className="h-5 w-5 text-orange-600" />
                                    </div>
                                    <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white border-2 border-white">
                                        {mounted ? itemCount : 0}
                                    </span>
                                </div>
                                <div className="hidden sm:flex flex-col items-start">
                                    <span className="text-[10px] text-gray-500">Sepetim</span>
                                    <span className="text-sm font-bold text-orange-600">
                                        <CartTotalDisplay />
                                    </span>
                                </div>
                            </Link>

                            {/* Mobile Menu Toggle */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="lg:hidden"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            >
                                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Mobile Search Row - only on very small screens */}
                <div className="sm:hidden border-t dark:border-gray-800/50 bg-white/50 dark:bg-gray-900/50 py-3 px-4 animate-in slide-in-from-top-1 duration-300">
                    <SearchInput />
                </div>
            </div>

            {/* Bottom Row: Category Navigation (Desktop) - STRIKING DESIGN */}
            <div
                className="hidden lg:block relative overflow-visible bg-[#17457C] bg-gradient-to-r from-[#0d2e5c]/95 via-[#17457C]/95 to-[#0d2e5c]/95 backdrop-blur-md shadow-lg"
            >
                {/* Glowing Line Effect */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#4FC3F7] to-transparent opacity-50" />
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#4FC3F7] to-transparent opacity-50" />

                <div className="container mx-auto px-4 relative z-10">
                    <div className="flex items-center">


                        <nav className="flex items-center justify-center w-full relative">
                            {/* Anasayfa (Home) Link */}
                            <div
                                className="group"
                                onMouseEnter={() => setHoveredCategory('home')}
                                onMouseLeave={() => setHoveredCategory(null)}
                            >
                                <Link
                                    href="/"
                                    onClick={() => setHoveredCategory(null)}
                                    className={`flex flex-col items-center justify-center px-4 py-4 md:px-6 md:py-5 transition-colors duration-150 ${
                                        hoveredCategory === 'home' ? "bg-white" : "hover:bg-white/10"
                                    }`}
                                >
                                    <span className={`flex items-center gap-2 text-sm font-bold transition-colors text-center whitespace-nowrap ${
                                        hoveredCategory === 'home' ? "text-[#17457C]" : "text-white"
                                    }`}>
                                        <Home className="w-4 h-4" />
                                        ANASAYFA
                                    </span>
                                </Link>
                            </div>

                            {categories
                                .filter(c => c.name !== "Home" && c.name !== "Root")
                                .map((category) => {
                                    const hasChildren = category.children && category.children.length > 0;
                                    const isHovered = hoveredCategory === category.id;
                                    
                                    return (
                                        <div
                                            key={category.id}
                                            className="group"
                                            onMouseEnter={() => setHoveredCategory(category.id)}
                                            onMouseLeave={() => setHoveredCategory(null)}
                                        >
                                            <Link
                                                href={`/category/${category.slug}`}
                                                onClick={() => setHoveredCategory(null)}
                                                className={`flex flex-col items-center justify-center px-4 py-4 md:px-6 md:py-5 transition-colors duration-150 ${
                                                    isHovered ? "bg-white" : "hover:bg-white/10"
                                                }`}
                                            >
                                                <span className={`text-sm font-bold transition-colors text-center whitespace-nowrap ${
                                                    isHovered ? "text-[#17457C]" : "text-white"
                                                }`}>
                                                    {category.name}
                                                </span>
                                            </Link>

                                            {/* Mega Menu Dropdown */}
                                            {isHovered && hasChildren && (
                                                <div className="absolute left-0 top-full w-full bg-white shadow-2xl border-t-2 border-[#17457C] z-50 p-8 rounded-b-xl flex gap-8 animate-in fade-in duration-150">
                                                    {/* Subcategories Grid */}
                                                    <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-3 content-start">
                                                        {category.children!.map(sub => (
                                                            <Link 
                                                                key={sub.id} 
                                                                href={`/category/${sub.slug}`} 
                                                                onClick={() => setHoveredCategory(null)}
                                                                className="text-sm text-gray-700 hover:text-[#17457C] hover:font-medium hover:translate-x-1 transition-all flex items-center gap-2"
                                                            >
                                                                <span className="w-1 h-1 rounded-full bg-gray-300 group-hover:bg-[#17457C]"></span>
                                                                {sub.name}
                                                            </Link>
                                                        ))}
                                                    </div>

                                                    {/* Mega Menu Promo Image Area - Large Floating Style */}
                                                    <div className="w-[450px] xl:w-[600px] shrink-0 hidden lg:flex items-center justify-end relative pl-8">
                                                        <Link 
                                                            href={`/category/${category.slug}`}
                                                            onClick={() => setHoveredCategory(null)}
                                                            className="w-full h-full flex items-center justify-end group/promo"
                                                        >
                                                            {(category.menuImageUrl || category.imageUrl) ? (
                                                                <div className="w-full h-[300px] relative">
                                                                    <Image 
                                                                        src={category.menuImageUrl || category.imageUrl || ""} 
                                                                        alt={category.name}
                                                                        fill
                                                                        className="object-contain object-right group-hover/promo:scale-105 transition-transform duration-500 drop-shadow-xl" 
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="w-full h-[200px] relative opacity-50">
                                                                    <Image 
                                                                        src="/placeholder.svg" 
                                                                        alt={category.name}
                                                                        fill
                                                                        className="object-contain object-right group-hover/promo:scale-105 transition-transform duration-500" 
                                                                    />
                                                                </div>
                                                            )}
                                                        </Link>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </nav>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="lg:hidden border-b dark:border-gray-800/50 bg-white dark:bg-gray-900 supports-[backdrop-filter]:bg-white/95 supports-[backdrop-filter]:dark:bg-gray-900/95 backdrop-blur-xl animate-in slide-in-from-top-2 duration-200 max-h-[80vh] overflow-y-auto">
                    <div className="container mx-auto px-4 py-4 space-y-4">
                        {/* Mobile Quick Actions */}
                        <div className="grid grid-cols-2 gap-2">
                            <Link
                                href="/cart"
                                className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-orange-50 text-orange-700 font-bold text-sm"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <ShoppingCart className="h-4 w-4" />
                                Sepetim ({mounted ? itemCount : 0})
                            </Link>
                            <Link
                                href={user ? "/account" : "/login"}
                                className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-blue-50 text-blue-700 font-bold text-sm"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <User className="h-4 w-4" />
                                {user ? "Hesabım" : "Giriş Yap"}
                            </Link>
                        </div>

                        {/* Mobile Categories - Expandable Sidebar Style */}
                        <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">Menü</p>
                            <Link
                                href="/"
                                className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-[#17457C] hover:bg-blue-50 rounded-lg transition-colors"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <Home className="w-4 h-4" />
                                ANASAYFA
                            </Link>
                            <Link
                                href="/products"
                                className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#17457C] hover:bg-blue-50 rounded-lg transition-colors"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-[#17457C]" />
                                Tüm Ürünler
                            </Link>
                            {mobileCategoryTree.map((category) => {
                                const hasChildren = category.children && category.children.length > 0;
                                return (
                                    <MobileCategoryItem
                                        key={category.id}
                                        category={category}
                                        hasChildren={hasChildren}
                                        onClose={() => setIsMobileMenuOpen(false)}
                                    />
                                );
                            })}
                        </div>

                        {/* Mobile Quick Links */}
                        <div className="border-t pt-4 space-y-1">
                            <Link
                                href="/about"
                                className="block px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                Hakkımızda
                            </Link>
                            <Link
                                href="/contact"
                                className="block px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                İletişim
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}

function MobileCategoryItem({ category, hasChildren, onClose }: { category: Category; hasChildren: boolean; onClose: () => void }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className={cn(
            "rounded-lg border border-gray-100 dark:border-gray-800 transition-all duration-200",
            isOpen && "shadow-sm ring-1 ring-blue-500/20"
        )}>
            <div className="flex items-center">
                <Link
                    href={`/category/${category.slug}`}
                    className="flex-1 flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-[#17457C] transition-colors"
                    onClick={onClose}
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    {category.name}
                </Link>
                {hasChildren && (
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-2.5 mr-1 rounded-lg text-gray-400 hover:text-[#17457C] hover:bg-blue-50 transition-all"
                    >
                        {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </button>
                )}
            </div>
            {isOpen && hasChildren && (
                <div className="px-4 pb-2 space-y-0.5 border-t border-gray-50 dark:border-gray-800/50">
                    {category.children!.map((child) => (
                        <Link
                            key={child.id}
                            href={`/category/${child.slug}`}
                            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-500 hover:text-[#17457C] hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            onClick={onClose}
                        >
                            <ChevronRight className="w-3 h-3 text-gray-300" />
                            {child.name}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

function CartTotalDisplay() {
    const total = useCartStore((state) => state.getSummary().total);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const formattedTotal = new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(total);

    if (!mounted) {
        return (
            <>
                {new Intl.NumberFormat("tr-TR", {
                    style: "currency",
                    currency: "TRY",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                }).format(0)}
            </>
        );
    }

    return <>{formattedTotal}</>;
}
