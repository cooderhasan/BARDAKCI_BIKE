"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Slider {
    id: string;
    title: string | null;
    subtitle: string | null;
    imageUrl: string;
    linkUrl: string | null;
    showOverlay: boolean;
}

interface HeroSliderProps {
    sliders: Slider[];
}

export function HeroSlider({ sliders }: HeroSliderProps) {
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        if (sliders.length <= 1) return;

        const interval = setInterval(() => {
            setCurrent((prev) => (prev + 1) % sliders.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [sliders.length]);

    const prev = () => {
        setCurrent((c) => (c === 0 ? sliders.length - 1 : c - 1));
    };

    const next = () => {
        setCurrent((c) => (c + 1) % sliders.length);
    };

    if (sliders.length === 0) {
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

    return (
        <div className="relative h-[400px] md:h-[500px] overflow-hidden">
            <AnimatePresence mode="wait">
                <motion.div
                    key={sliders[current].id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7 }}
                    className="absolute inset-0"
                >
                    {sliders[current].linkUrl ? (
                        <Link 
                            href={sliders[current].linkUrl} 
                            className="absolute inset-0 block"
                            aria-label={sliders[current].title || "Slayt Kampanya Detayı"}
                        >
                            {/* Background */}
                            {sliders[current].showOverlay && (
                                <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent z-10" />
                            )}
                            <div className="absolute inset-0 bg-gray-900">
                                {sliders[current].imageUrl && (
                                    <Image
                                        src={sliders[current].imageUrl}
                                        alt={sliders[current].title || "Slayt Kampanya Görseli"}
                                        fill
                                        className="object-cover object-right"
                                        priority={true}
                                        sizes="100vw"
                                    />
                                )}
                            </div>

                            {/* Content */}
                            {sliders[current].showOverlay && (
                                <div className="relative z-20 h-full flex items-center">
                                    <div className="container mx-auto px-4 pl-16 md:pl-24">
                                        <div className="max-w-2xl">
                                            {sliders[current].title && (
                                                <motion.h2
                                                    initial={{ y: 20, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    transition={{ delay: 0.3, duration: 0.5 }}
                                                    className="text-3xl md:text-5xl font-bold text-white mb-4"
                                                >
                                                    {sliders[current].title}
                                                </motion.h2>
                                            )}
                                            {sliders[current].subtitle && (
                                                <motion.p
                                                    initial={{ y: 20, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    transition={{ delay: 0.5, duration: 0.5 }}
                                                    className="text-xl text-gray-200 mb-6"
                                                >
                                                    {sliders[current].subtitle}
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
                            {sliders[current].showOverlay && (
                                <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent z-10" />
                            )}
                            <div className="absolute inset-0 bg-gray-900">
                                {sliders[current].imageUrl && (
                                    <Image
                                        src={sliders[current].imageUrl}
                                        alt={sliders[current].title || "Slayt Kampanya Görseli"}
                                        fill
                                        className="object-cover object-right"
                                        priority={true}
                                        sizes="100vw"
                                    />
                                )}
                            </div>

                            {/* Content */}
                            {sliders[current].showOverlay && (
                                <div className="relative z-20 h-full flex items-center">
                                    <div className="container mx-auto px-4 pl-16 md:pl-24">
                                        <div className="max-w-2xl">
                                            {sliders[current].title && (
                                                <motion.h2
                                                    initial={{ y: 20, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    transition={{ delay: 0.3, duration: 0.5 }}
                                                    className="text-3xl md:text-5xl font-bold text-white mb-4"
                                                >
                                                    {sliders[current].title}
                                                </motion.h2>
                                            )}
                                            {sliders[current].subtitle && (
                                                <motion.p
                                                    initial={{ y: 20, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    transition={{ delay: 0.5, duration: 0.5 }}
                                                    className="text-xl text-gray-200 mb-6"
                                                >
                                                    {sliders[current].subtitle}
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

            {/* Navigation */}
            {sliders.length > 1 && (
                <>
                    <button
                        onClick={prev}
                        aria-label="Önceki Slayt"
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                        onClick={next}
                        aria-label="Sonraki Slayt"
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                    >
                        <ChevronRight className="h-6 w-6" />
                    </button>

                    {/* Dots */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
                        {sliders.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrent(index)}
                                aria-label={`Slayt ${index + 1}`}
                                className={`w-2 h-2 rounded-full transition-all ${index === current
                                    ? "bg-white w-6"
                                    : "bg-white/50 hover:bg-white/75"
                                    }`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
