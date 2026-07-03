"use client";

import { useEffect, useState } from "react";

export function WhatsAppButton({ phone }: { phone?: string }) {
    const [isVisible, setIsVisible] = useState(false);
    const [hasConsent, setHasConsent] = useState(true);

    useEffect(() => {
        // Sayfa yüklendikten kısa süre sonra animate ile görün
        const timer = setTimeout(() => setIsVisible(true), 500);

        // İlk yüklemede çerez tercihini kontrol et
        const consent = typeof window !== "undefined" ? localStorage.getItem("cookie-consent") : "true";
        setHasConsent(!!consent);

        // Çerez tercihindeki değişiklikleri periyodik olarak dinle
        const interval = setInterval(() => {
            const currentConsent = typeof window !== "undefined" ? localStorage.getItem("cookie-consent") : "true";
            if (!!currentConsent !== hasConsent) {
                setHasConsent(!!currentConsent);
            }
        }, 1000);

        return () => {
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, [hasConsent]);

    if (!phone) return null;

    // Telefon numarasını Türkiye/Genel formata çevir
    // Boşlukları ve yabancı karakterleri temizle
    let cleanPhone = phone.replace(/[^0-9]/g, "");
    
    // Eğer başında 0 varsa atıp 90 ekle
    if (cleanPhone.startsWith('0')) {
        cleanPhone = '90' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('90') && cleanPhone.length === 10) {
        // Eğer 10 hane ise ve 90 ile başlamıyorsa (örn: 5351234567), 90 ekle
        cleanPhone = '90' + cleanPhone;
    }

    return (
        <a
            href={`https://wa.me/${cleanPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`
                fixed right-6 z-[9999] 
                flex items-center justify-center 
                w-14 h-14 rounded-full 
                bg-[#25D366] text-white
                shadow-[0_4px_14px_rgba(37,211,102,0.4)]
                hover:scale-110 hover:shadow-[0_6px_20px_rgba(37,211,102,0.6)]
                transition-all duration-300
                ${hasConsent ? "bottom-6" : "bottom-28 sm:bottom-6"}
                ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
            `}
            aria-label="WhatsApp Destek Hattı"
        >
            {/* Resmi WhatsApp Logosu */}
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 ml-0.5 mt-0.5">
                <path d="M12.031 0C5.394 0 0 5.394 0 12.031c0 2.126.554 4.195 1.609 6.012L.412 24l6.113-1.603a11.968 11.968 0 005.506 1.341h.005c6.634 0 12.028-5.394 12.028-12.031S18.665 0 12.031 0zm0 21.724h-.004a9.927 9.927 0 01-5.068-1.385l-.364-.216-3.768.988 1.006-3.673-.237-.377a9.922 9.922 0 01-1.52-5.342c0-5.487 4.464-9.95 9.955-9.95s9.955 4.463 9.955 9.95-4.463 9.95-9.955 9.95zm5.457-7.448c-.299-.15-1.771-.875-2.045-.975-.274-.1-.474-.15-.674.15-.2.3-.773.975-.947 1.175-.174.2-.349.225-.648.075-.299-.15-1.263-.465-2.405-1.485-.889-.793-1.488-1.773-1.663-2.073-.174-.3-.018-.462.132-.612.134-.135.299-.35.449-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.674-1.625-.923-2.225-.242-.585-.488-.506-.674-.515-.175-.008-.374-.01-.574-.01-.2 0-.523.075-.798.375-.274.3-1.047 1.025-1.047 2.5s1.072 2.9 1.222 3.1c.15.2 2.112 3.223 5.116 4.522.716.31 1.275.495 1.708.634.718.229 1.371.196 1.888.119.58-.087 1.771-.725 2.021-1.425.25-.7.25-1.3.175-1.425-.075-.125-.275-.2-.574-.35z"/>
            </svg>
        </a>
    );
}
