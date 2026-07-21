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
        if (!sliders || sliders.length <= 1) return;

        const interval = setInterval(() => {
            setCurrent((prev) => (prev + 1) % sliders.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [sliders?.length]);

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

    return (
        <div className="relative h-[400px] md:h-[500px] overflow-hidden">
            <AnimatePresence mode="wait">
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
                            <div className="absolute inset-0 bg-gray-900">
                                {currentSlide.imageUrl && (
                                    <Image
                                        src={currentSlide.imageUrl}
                                        alt={currentSlide.title || "Slayt Kampanya Görseli"}
                                        fill
                                        className="object-cover object-right"
                                        priority={true}
                                        sizes="100vw"
                                    />
                                )}
                            </div>

                            {/* Content */}
                            {currentSlide.showOverlay && (
                                <div className="relative z-20 h-full flex items-center">
                                    <div className="container mx-auto px-4 pl-16 md:pl-24">
                                        <div className="max-w-2xl">
                                            {currentSlide.title && (
                                                <motion.h2
                                                    initial={{ y: 20, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    transition={{ delay: 0.3, duration: 0.5 }}
                                                    className="text-3xl md:text-5xl font-bold text-white mb-4"
                                                >
                                                    {currentSlide.title}
                                                </motion.h2>
                                            )}
                                            {currentSlide.subtitle && (
                                                <motion.p
                                                    initial={{ y: 20, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    transition={{ delay: 0.5, duration: 0.5 }}
                                                    className="text-xl text-gray-200 mb-6"
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
                            <div className="absolute inset-0 bg-gray-900">
                                {currentSlide.imageUrl && (
                                    <Image
                                        src={currentSlide.imageUrl}
                                        alt={currentSlide.title || "Slayt Kampanya Görseli"}
                                        fill
                                        className="object-cover object-right"
                                        priority={true}
                                        sizes="100vw"
                                    />
                                )}
                            </div>

                            {/* Content */}
                            {currentSlide.showOverlay && (
                                <div className="relative z-20 h-full flex items-center">
                                    <div className="container mx-auto px-4 pl-16 md:pl-24">
                                        <div className="max-w-2xl">
                                            {currentSlide.title && (
                                                <motion.h2
                                                    initial={{ y: 20, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    transition={{ delay: 0.3, duration: 0.5 }}
                                                    className="text-3xl md:text-5xl font-bold text-white mb-4"
                                                >
                                                    {currentSlide.title}
                                                </motion.h2>
                                            )}
                                            {currentSlide.subtitle && (
                                                <motion.p
                                                    initial={{ y: 20, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    transition={{ delay: 0.5, duration: 0.5 }}
                                                    className="text-xl text-gray-200 mb-6"
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
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                        onClick={next}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>

                    {/* Indicators */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
                        {sliders.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrent(index)}
                                className={`w-3 h-3 rounded-full transition-colors ${
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
