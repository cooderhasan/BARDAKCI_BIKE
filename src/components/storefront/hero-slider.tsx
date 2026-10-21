"use client";

import { getImageProps } from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface Slider {
    id: string;
    title: string | null;
    subtitle: string | null;
    imageUrl: string;
    mobileImageUrl?: string | null;
    linkUrl: string | null;
    showOverlay: boolean;
}

/**
 * Slayt görseli. Mobil görsel varsa <picture> ile telefonda (768px altı) kare mobil görsel, büyük ekranda geniş görsel
 * indirilir (ikisi birden indirilmez). Mobil görseli olmayan slayt, slider kare iken kutuya sığdırılır (kırpılmaz).
 */
function SlideImage({ slide, squareOnMobile, priority, active }: { slide: Slider; squareOnMobile: boolean; priority: boolean; active: boolean }) {
    const alt = slide.title || "Slayt Kampanya Görseli";
    const { props: desktop } = getImageProps({
        src: slide.imageUrl,
        alt,
        fill: true,
        priority,
        sizes: "(max-width: 1280px) 100vw, 1216px",
    });
    const mobileSrcSet = slide.mobileImageUrl
        ? getImageProps({ src: slide.mobileImageUrl, alt, fill: true, priority, sizes: "100vw" }).props.srcSet
        : undefined;
    const fit = squareOnMobile && !slide.mobileImageUrl ? "object-contain md:object-cover" : "object-cover";
    return (
        <picture>
            {mobileSrcSet && <source media="(max-width: 767px)" srcSet={mobileSrcSet} sizes="100vw" />}
            {/* Aktif slaytta 6 sn'de çok hafif yakınlaşma; diğer slaytlar da önceden yüklenir (geçişte geç gelmesin) */}
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img
                {...desktop}
                loading="eager"
                className={`${fit} transition-transform ease-out ${active ? "scale-[1.04] duration-[6000ms]" : "scale-100 duration-700"}`}
            />
        </picture>
    );
}

const SLIDE_MS = 6000;

interface HeroSliderProps {
    sliders: Slider[];
}

export function HeroSlider({ sliders }: HeroSliderProps) {
    const [current, setCurrent] = useState(0);
    const [paused, setPaused] = useState(false);

    // Her slayt değişiminde süre baştan başlar (elle geçişten hemen sonra atlamasın); fare üstündeyken durur
    useEffect(() => {
        if (!sliders || sliders.length <= 1 || paused) return;
        const t = setTimeout(() => setCurrent((prev) => (prev + 1) % sliders.length), SLIDE_MS);
        return () => clearTimeout(t);
    }, [sliders?.length, current, paused]);

    // Telefonda parmakla kaydırma
    const touchX = useRef<number | null>(null);
    const onTouchStart = (e: React.TouchEvent) => {
        touchX.current = e.touches[0]?.clientX ?? null;
    };
    const onTouchEnd = (e: React.TouchEvent) => {
        if (touchX.current === null) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
    };

    const prev = () => {
        if (!sliders || sliders.length === 0) return;
        setCurrent((c) => (c === 0 ? sliders.length - 1 : c - 1));
    };

    const next = () => {
        if (!sliders || sliders.length === 0) return;
        setCurrent((c) => (c + 1) % sliders.length);
    };

    if (!sliders || sliders.length === 0) {
        return (
            <div className="relative h-[400px] md:h-[500px] bg-gray-900 flex items-center justify-center">
                <div className="text-center text-white px-4">
                    <h1 className="text-3xl md:text-5xl font-bold mb-4">
                        B2B Toptancı E-Ticaret
                    </h1>
                    <p className="text-xl text-[#B3E5FC] mb-6">
                        Bayilere özel fiyatlarla toptan alışveriş
                    </p>
                    <Link href="/products">
                        <Button size="lg" variant="secondary">
                            Ürünleri Keşfet
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    // Herhangi bir slaytın mobil görseli varsa telefonda slider kare olur
    const squareOnMobile = sliders.some((s) => s.mobileImageUrl);

    const renderOverlay = (slide: Slider, active: boolean) =>
        slide.showOverlay && (
            <div className="relative z-20 h-full flex items-center">
                <div className="container mx-auto px-4 md:pl-24">
                    <div className={`max-w-2xl transition-all duration-700 delay-300 ${active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
                        {slide.title && <h2 className="text-lg md:text-5xl font-bold text-white mb-2 md:mb-4">{slide.title}</h2>}
                        {slide.subtitle && <p className="hidden md:block text-xl text-gray-200 mb-6">{slide.subtitle}</p>}
                        {slide.linkUrl && <Button size="lg">Keşfet</Button>}
                    </div>
                </div>
            </div>
        );

    return (
        // Kutu slider görselinin oranında (yüklenen görseller ~2:1 - 2.5:1)
        <div
            className={`relative w-full ${squareOnMobile ? "aspect-square md:aspect-[2.2/1]" : "aspect-[2.2/1]"} max-h-[520px] overflow-hidden bg-gray-100 dark:bg-gray-800`}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            {/* Tüm slaytlar üst üste: eski solarken yeni aynı anda belirir (çapraz geçiş). Önceden eski tamamen kaybolup
                arada gri arka plan görünüyordu. İlk slayt sunucudan hemen görünür. */}
            {sliders.map((slide, i) => {
                const active = i === current;
                const body = (
                    <>
                        {slide.showOverlay && <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent z-10" />}
                        <div className="absolute inset-0">
                            {slide.imageUrl && <SlideImage slide={slide} squareOnMobile={squareOnMobile} priority={i === 0} active={active} />}
                        </div>
                        {renderOverlay(slide, active)}
                    </>
                );
                return (
                    <div
                        key={slide.id}
                        aria-hidden={!active}
                        className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${active ? "opacity-100 z-[1]" : "opacity-0 z-0 pointer-events-none"}`}
                    >
                        {slide.linkUrl ? (
                            <Link href={slide.linkUrl} className="absolute inset-0 block" aria-label={slide.title || "Slayt Kampanya Detayı"} tabIndex={active ? 0 : -1}>
                                {body}
                            </Link>
                        ) : (
                            <div className="absolute inset-0">{body}</div>
                        )}
                    </div>
                );
            })}

            {/* Navigation Buttons */}
            {sliders.length > 1 && (
                <>
                    <button
                        onClick={prev}
                        aria-label="Önceki slayt"
                        className="hidden md:block absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                        onClick={next}
                        aria-label="Sonraki slayt"
                        className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>

                    {/* Indicators */}
                    <div className="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-1.5 md:gap-2">
                        {sliders.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrent(index)}
                                aria-label={`${index + 1}. slayt`}
                                className={`h-2 rounded-full transition-all duration-500 shadow-sm ${
                                    index === current ? "w-6 md:w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                                }`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
