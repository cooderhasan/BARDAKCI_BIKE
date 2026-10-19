"use client";

import { getImageProps } from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
function SlideImage({ slide, squareOnMobile }: { slide: Slider; squareOnMobile: boolean }) {
    const alt = slide.title || "Slayt Kampanya Görseli";
    const { props: desktop } = getImageProps({
        src: slide.imageUrl,
        alt,
        fill: true,
        priority: true,
        sizes: "(max-width: 1280px) 100vw, 1216px",
    });
    const mobileSrcSet = slide.mobileImageUrl
        ? getImageProps({ src: slide.mobileImageUrl, alt, fill: true, priority: true, sizes: "100vw" }).props.srcSet
        : undefined;
    const fit = squareOnMobile && !slide.mobileImageUrl ? "object-contain md:object-cover" : "object-cover";
    return (
        <picture>
            {mobileSrcSet && <source media="(max-width: 767px)" srcSet={mobileSrcSet} sizes="100vw" />}
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img {...desktop} className={fit} />
        </picture>
    );
}

interface HeroSliderProps {
    sliders: Slider[];
}

export function HeroSlider({ sliders }: HeroSliderProps) {
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        if (!sliders || sliders.length <= 1) return;

        const interval = setInterval(() => {
            setCurrent((prev) => (prev + 1) % sliders.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [sliders?.length]);

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

    const currentSlide = sliders[current] || sliders[0];
    if (!currentSlide) return null;
    // Herhangi bir slaytın mobil görseli varsa telefonda slider kare olur
    const squareOnMobile = sliders.some((s) => s.mobileImageUrl);

    return (
        // Kutu slider görselinin oranında (yüklenen görseller ~2:1 - 2.5:1). Eskiden sabit 400/500px yükseklikti;
        // telefonda kutu neredeyse kare olduğu için görselin yarısı (yazılar) kesiliyordu.
        <div
            className={`relative w-full ${squareOnMobile ? "aspect-square md:aspect-[2.2/1]" : "aspect-[2.2/1]"} max-h-[520px] overflow-hidden bg-gray-100 dark:bg-gray-800`}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            {/* initial={false}: ilk slayt animasyonsuz, sunucudan gelen HTML'de hemen görünür (önce soluk/boş geliyordu) */}
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={currentSlide.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7 }}
                    className="absolute inset-0"
                >
                    {currentSlide.linkUrl ? (
                        <Link 
                            href={currentSlide.linkUrl} 
                            className="absolute inset-0 block"
                            aria-label={currentSlide.title || "Slayt Kampanya Detayı"}
                        >
                            {/* Background */}
                            {currentSlide.showOverlay && (
                                <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent z-10" />
                            )}
                            <div className="absolute inset-0">
                                {currentSlide.imageUrl && <SlideImage slide={currentSlide} squareOnMobile={squareOnMobile} />}
                            </div>

                            {/* Content */}
                            {currentSlide.showOverlay && (
                                <div className="relative z-20 h-full flex items-center">
                                    <div className="container mx-auto px-4 md:pl-24">
                                        <div className="max-w-2xl">
                                            {currentSlide.title && (
                                                <motion.h2
                                                    initial={{ y: 20, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    transition={{ delay: 0.3, duration: 0.5 }}
                                                    className="text-lg md:text-5xl font-bold text-white mb-2 md:mb-4"
                                                >
                                                    {currentSlide.title}
                                                </motion.h2>
                                            )}
                                            {currentSlide.subtitle && (
                                                <motion.p
                                                    initial={{ y: 20, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    transition={{ delay: 0.5, duration: 0.5 }}
                                                    className="hidden md:block text-xl text-gray-200 mb-6"
                                                >
                                                    {currentSlide.subtitle}
                                                </motion.p>
                                            )}
                                            <motion.div
                                                initial={{ y: 20, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                transition={{ delay: 0.7, duration: 0.5 }}
                                            >
                                                <Button size="lg">Keşfet</Button>
                                            </motion.div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Link>
                    ) : (
                        <div className="absolute inset-0">
                            {/* Background */}
                            {currentSlide.showOverlay && (
                                <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent z-10" />
                            )}
                            <div className="absolute inset-0">
                                {currentSlide.imageUrl && <SlideImage slide={currentSlide} squareOnMobile={squareOnMobile} />}
                            </div>

                            {/* Content */}
                            {currentSlide.showOverlay && (
                                <div className="relative z-20 h-full flex items-center">
                                    <div className="container mx-auto px-4 md:pl-24">
                                        <div className="max-w-2xl">
                                            {currentSlide.title && (
                                                <motion.h2
                                                    initial={{ y: 20, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    transition={{ delay: 0.3, duration: 0.5 }}
                                                    className="text-lg md:text-5xl font-bold text-white mb-2 md:mb-4"
                                                >
                                                    {currentSlide.title}
                                                </motion.h2>
                                            )}
                                            {currentSlide.subtitle && (
                                                <motion.p
                                                    initial={{ y: 20, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    transition={{ delay: 0.5, duration: 0.5 }}
                                                    className="hidden md:block text-xl text-gray-200 mb-6"
                                                >
                                                    {currentSlide.subtitle}
                                                </motion.p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

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
                                className={`w-2 h-2 md:w-3 md:h-3 rounded-full transition-colors ${
                                    index === current ? "bg-white" : "bg-white/40"
                                }`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
