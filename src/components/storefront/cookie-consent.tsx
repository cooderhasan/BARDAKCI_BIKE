"use strict";
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export function CookieConsent() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem("cookie-consent");
        if (!consent) {
            setIsVisible(true);
        }
    }, []);

    const acceptCookies = () => {
        localStorage.setItem("cookie-consent", "true");
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 md:p-6 animate-in slide-in-from-bottom duration-500">
            <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex-1 text-sm text-gray-600">
                    <p>
                        Sizlere daha iyi hizmet sunabilmek için sitemizde çerezler (cookies) kullanılmaktadır.
                        Detaylı bilgi için <Link href="/policies/gizlilik-i-lkelerimiz" className="text-[#17457C] hover:underline font-medium">Gizlilik Politikamızı</Link> inceleyebilirsiniz.
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={acceptCookies}
                        className="w-full md:w-auto bg-black text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors whitespace-nowrap"
                    >
                        Kabul Et
                    </button>
                    <button
                        onClick={() => setIsVisible(false)}
                        className="md:hidden w-12 h-12 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 shrink-0"
                        aria-label="Kapat"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
