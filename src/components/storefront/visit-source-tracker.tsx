"use client";

import { useEffect } from "react";
import { captureVisitSource } from "@/lib/visit-source";

/** Ziyaretçinin siteye nereden geldiğini (Google, Instagram, direkt...) tarayıcısına not eder; siparişe yazılır */
export function VisitSourceTracker() {
    useEffect(() => {
        captureVisitSource();
    }, []);
    return null;
}
