import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { JsonLd } from "@/components/seo/json-ld";
import { getAllFAQs } from "@/app/actions/faq";
import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle, Phone, Mail, ArrowRight, MessageSquare, Truck, ShieldCheck, CreditCard, UserPlus } from "lucide-react";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: "Sıkça Sorulan Sorular (S.S.S)",
    description: "Toptan satış, bayilik süreçleri, ödeme seçenekleri, kargo teslimatı ve kurulum hakkında merak ettiğiniz tüm soruların yanıtları.",
    keywords: ["b2b e-ticaret sss", "toptan satış sss", "bayilik başvuru", "kargo teslimatı sss"],
    openGraph: {
        title: "Sıkça Sorulan Sorular (S.S.S)",
        description: "Siparişler, kargo teslimatı, garanti ve bayilik süreçleriyle ilgili tüm merak edilenler bu sayfada.",
        type: "website",
    }
};

interface FAQGroup {
    category: string;
    title: string;
    icon: React.ReactNode;
    items: any[];
}

export default async function FAQPage() {
    const faqs = await getAllFAQs(true); // Fetch only active FAQs from database

    const baseGroups: FAQGroup[] = [
        {
            category: "membership",
            title: "Üyelik & Bayilik",
            icon: <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
            items: faqs.filter(f => f.category === "membership")
        },
        {
            category: "orders",
            title: "Sipariş & Ödeme",
            icon: <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
            items: faqs.filter(f => f.category === "orders")
        },
        {
            category: "shipping",
            title: "Teslimat & Kargo",
            icon: <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
            items: faqs.filter(f => f.category === "shipping")
        },
        {
            category: "service",
            title: "Kurulum, Garanti & İade",
            icon: <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
            items: faqs.filter(f => f.category === "service")
        }
    ];

    // Filter out groups with no items
    const faqGroups = baseGroups.filter(g => g.items.length > 0);

    // Collect any other categories not covered by base categories
    const otherItems = faqs.filter(f => !["membership", "orders", "shipping", "service"].includes(f.category));
    if (otherItems.length > 0) {
        faqGroups.push({
            category: "other",
            title: "Diğer Konular",
            icon: <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
            items: otherItems
        });
    }

    // Build the JSON-LD FAQ Schema
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs.map(faq => ({
            "@type": "Question",
            "name": faq.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer
            }
        }))
    };

    return (
        <>
            <JsonLd data={faqSchema} />
            <div className="bg-gray-50/50 dark:bg-gray-900/50 min-h-screen pb-16">
                {/* Hero Header Section */}
                <div className="bg-gradient-to-r from-[#002838] to-[#001018] text-white py-16 px-4 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('/pattern.png')] bg-repeat opacity-5 pointer-events-none" />
                    <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="max-w-3xl mx-auto relative z-10 space-y-4">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 text-blue-300 text-xs font-semibold tracking-wider uppercase backdrop-blur-sm border border-white/5">
                            <HelpCircle className="h-4 w-4" /> Destek & Yardım Merkezi
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black tracking-tight">
                            Sıkça Sorulan Sorular
                        </h1>
                        <p className="text-gray-300 max-w-xl mx-auto text-sm md:text-base leading-relaxed font-medium">
                            Bardakcı Bike üzerinden yapacağınız toptan ve perakende alışverişler, üyelik modelleri, ödeme, teslimat ve servis süreçleri hakkında aradığınız tüm cevaplar.
                        </p>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="max-w-4xl mx-auto px-4 mt-12">
                    {faqGroups.length === 0 ? (
                        <div className="text-center bg-white dark:bg-gray-800 rounded-2xl p-12 shadow-sm border border-gray-100 dark:border-gray-700">
                            <HelpCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Soru Bulunamadı</h2>
                            <p className="text-gray-500 text-sm">
                                Şu anda sisteme eklenmiş sıkça sorulan soru bulunmamaktadır. Lütfen daha sonra tekrar deneyiniz.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-8">
                            {faqGroups.map((group) => (
                                <div 
                                    key={group.category} 
                                    className="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700/60 hover:shadow-md transition-all duration-300"
                                >
                                    <div className="flex items-center gap-3 mb-6 pb-3 border-b border-gray-100 dark:border-gray-700">
                                        <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                                            {group.icon}
                                        </div>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                            {group.title}
                                        </h2>
                                    </div>

                                    <Accordion type="single" collapsible className="w-full space-y-2">
                                        {group.items.map((item) => (
                                            <AccordionItem 
                                                key={item.id} 
                                                value={item.id}
                                                className="border border-gray-100 dark:border-gray-700/50 rounded-xl px-4 md:px-5 hover:border-blue-100 dark:hover:border-blue-900/40 hover:bg-gray-50/30 dark:hover:bg-gray-800/30 transition-all"
                                            >
                                                <AccordionTrigger className="text-left text-sm md:text-base font-bold text-gray-800 dark:text-gray-200 hover:text-blue-700 dark:hover:text-blue-400 hover:no-underline py-4">
                                                    {item.question}
                                                </AccordionTrigger>
                                                <AccordionContent className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed pb-4 pt-1 font-medium whitespace-pre-line">
                                                    {item.answer}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Support Call-to-Action Card */}
                    <div className="mt-12 bg-gradient-to-r from-blue-700 to-blue-600 dark:from-blue-800 dark:to-blue-700 text-white rounded-3xl p-8 md:p-10 shadow-xl relative overflow-hidden group">
                        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute left-1/3 bottom-0 w-32 h-32 bg-black/10 rounded-full blur-xl pointer-events-none" />
                        
                        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="space-y-3 text-center md:text-left max-w-lg">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold uppercase tracking-wider">
                                    <MessageSquare className="h-3.5 w-3.5" /> 7/24 Aktif Destek
                                </div>
                                <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                                    Aklınızda başka bir soru mu var?
                                </h3>
                                <p className="text-blue-100 text-sm leading-relaxed font-medium">
                                    Aradığınız cevabı bulamadıysanız müşteri temsilcilerimizle doğrudan iletişime geçebilirsiniz. Size yardımcı olmaktan mutluluk duyarız.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto shrink-0">
                                <Link 
                                    href="/contact" 
                                    className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm"
                                >
                                    <Mail className="h-4 w-4" /> Bize Yazın
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                                <a 
                                    href="tel:+905540144142"
                                    className="flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-800/40 text-white hover:bg-blue-800/60 font-bold rounded-xl border border-white/20 transition-all active:scale-95 text-sm"
                                >
                                    <Phone className="h-4 w-4" /> +90 554 014 4142
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
