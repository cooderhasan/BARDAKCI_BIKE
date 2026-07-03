import Link from "next/link";
import Image from "next/image";

interface Policy {
    slug: string;
    title: string;
}

interface Category {
    id: string;
    name: string;
    slug: string;
}

interface StorefrontFooterProps {
    settings?: Record<string, string>;
    policies?: Policy[];
    categories?: Category[];
}

export function StorefrontFooter({ settings, policies, categories = [] }: StorefrontFooterProps) {
    // Separate policies into groups if needed, or just list them all
    // For now, let's put "payment-methods" apart if we want, or just filter it out from the general list if we handle it separately.
    // User requested "Combine", so let's just list them.
    // However, usually "Payment Methods" is a policy too.

    const footerPolicies = policies || [];

    return (
        <footer className="bg-gradient-to-b from-[#002838] to-[#001018] text-gray-300 border-t border-white/10 relative overflow-hidden">
            {/* Subtle Top Glow */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#17457C]/50 to-transparent" />

            <div className="container mx-auto px-4 py-16 pb-24 md:pb-16 text-center md:text-left relative z-10">
                <div className="grid gap-12 grid-cols-2 md:grid-cols-4">
                    {/* Company Info */}
                    <div className="space-y-6 col-span-2 md:col-span-1">
                        <div className="flex items-center justify-center md:justify-start gap-2 group">
                            {settings?.logoUrl ? (
                                <Image
                                    src={settings.logoUrl}
                                    alt={settings?.siteName || "Logo"}
                                    width={0}
                                    height={0}
                                    sizes="200px"
                                    className="h-10 w-auto object-contain brightness-0 invert"
                                />
                            ) : (
                                <div className="flex items-center gap-2 transition-transform duration-300 group-hover:scale-105">
                                    <div className="w-10 h-10 bg-[#17457C] rounded-xl flex items-center justify-center transform -rotate-3 shadow-lg shadow-[#17457C]/20 group-hover:rotate-0 transition-transform">
                                        <span className="text-white font-extrabold text-xl">B</span>
                                    </div>
                                    <div className="flex flex-col leading-none">
                                        <span className="font-black text-2xl text-white tracking-tight uppercase">
                                            BARDAKCI
                                        </span>
                                        <span className="font-bold text-sm text-[#17457C] tracking-widest uppercase">
                                            BIKE
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto md:mx-0">
                            {settings?.seoDescription || "Hayalinizdeki bisiklete giden en güvenilir yol. Her yaşa ve tarza uygun orijinal bisiklet modelleriyle sürüş keyfinizi zirveye taşıyın."}
                        </p>
                        <div className="flex justify-center md:justify-start gap-3 pt-2">
                            {/* Social Icons - Modern Glass Style */}
                            {settings?.facebookUrl && (
                                <a
                                    href={settings.facebookUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 bg-white/5 hover:bg-[#1877F2] hover:text-white rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg backdrop-blur-sm border border-white/5"
                                    title="Facebook"
                                    aria-label="Facebook Sayfamız"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z" />
                                    </svg>
                                </a>
                            )}
                            {settings?.instagramUrl && (
                                <a
                                    href={settings.instagramUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 bg-white/5 hover:bg-[#E4405F] hover:text-white rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg backdrop-blur-sm border border-white/5"
                                    title="Instagram"
                                    aria-label="Instagram Sayfamız"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                    </svg>
                                </a>
                            )}
                            {settings?.twitterUrl && (
                                <a
                                    href={settings.twitterUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 bg-white/5 hover:bg-[#1DA1F2] hover:text-white rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg backdrop-blur-sm border border-white/5"
                                    title="X (Twitter)"
                                    aria-label="X (Twitter) Sayfamız"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                    </svg>
                                </a>
                            )}
                            {settings?.linkedinUrl && (
                                <a
                                    href={settings.linkedinUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 bg-white/5 hover:bg-[#0A66C2] hover:text-white rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg backdrop-blur-sm border border-white/5"
                                    title="LinkedIn"
                                    aria-label="LinkedIn Sayfamız"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                    </svg>
                                </a>
                            )}
                            {settings?.tiktokUrl && (
                                <a
                                    href={settings.tiktokUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 bg-white/5 hover:bg-[#000000] hover:text-white rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg backdrop-blur-sm border border-white/5"
                                    title="TikTok"
                                    aria-label="TikTok Sayfamız"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.13-1.47-.13-.08-.27-.17-.41-.26v8.43c.02 1.62-.27 3.27-1.03 4.71-.9 1.73-2.43 3.12-4.25 3.8-1.72.65-3.63.74-5.4.31-1.74-.4-3.33-1.39-4.48-2.75-1.18-1.38-1.85-3.17-1.89-4.99-.04-1.9.5-3.83 1.62-5.38 1.11-1.55 2.78-2.67 4.63-3.1 1.75-.42 3.63-.23 5.25.54.02.16.05.32.05.48-.01 1.4-.01 2.8 0 4.2-.08-.04-.15-.07-.22-.12-1.02-.62-2.31-.75-3.44-.35-.95.32-1.77 1.05-2.22 1.95-.49.95-.56 2.1-.2 3.1.34.99 1.07 1.83 2 2.3 1.01.53 2.25.56 3.28.08 1.02-.45 1.78-1.41 1.98-2.5.09-.54.08-1.1.08-1.65V0h.02z" />
                                    </svg>
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="md:pl-8">
                        <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-sm border-b border-[#17457C]/30 pb-2 inline-block">Hızlı Bağlantılar</h4>
                        <ul className="space-y-3 text-sm">
                            {categories.map((category) => (
                                <li key={category.id}>
                                    <Link href={`/category/${category.slug}`} className="text-gray-400 hover:text-white hover:translate-x-1 transition-all duration-300 flex items-center gap-2 uppercase text-xs font-semibold tracking-wider">
                                        <span className="h-1 w-1 bg-[#17457C] rounded-full opacity-0 hover:opacity-100 transition-opacity"></span>
                                        {category.name}
                                    </Link>
                                </li>
                            ))}
                            <li>
                                <Link href="/about" className="text-gray-400 hover:text-white hover:translate-x-1 transition-all duration-300 flex items-center gap-2">
                                    <span className="h-1 w-1 bg-[#17457C] rounded-full opacity-0 hover:opacity-100 transition-opacity"></span>
                                    Hakkımızda
                                </Link>
                            </li>
                            <li>
                                <Link href="/contact" className="text-gray-400 hover:text-white hover:translate-x-1 transition-all duration-300 flex items-center gap-2">
                                    <span className="h-1 w-1 bg-[#17457C] rounded-full opacity-0 hover:opacity-100 transition-opacity"></span>
                                    İletişim
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Corporate & Policies */}
                    <div>
                        <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-sm border-b border-[#17457C]/30 pb-2 inline-block">Kurumsal</h4>
                        <ul className="space-y-3 text-sm">
                            {footerPolicies.map((policy) => (
                                <li key={policy.slug}>
                                    <Link href={`/policies/${policy.slug}`} className="text-gray-400 hover:text-white hover:translate-x-1 transition-all duration-300 flex items-center gap-2">
                                        <span className="h-1 w-1 bg-[#17457C] rounded-full opacity-0 hover:opacity-100 transition-opacity"></span>
                                        {policy.title}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-sm border-b border-[#17457C]/30 pb-2 inline-block">Bize Ulaşın</h4>
                        <ul className="space-y-4 text-sm text-gray-400">
                            {settings?.phone && (
                                <li className="flex items-start gap-3 group">
                                    <div className="min-w-[2rem] w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-[#17457C] transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-300 group-hover:text-white">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                                        </svg>
                                    </div>
                                    <span className="pt-1">{settings.phone}</span>
                                </li>
                            )}
                            {settings?.email && (
                                <li className="flex items-start gap-3 group">
                                    <div className="min-w-[2rem] w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-[#17457C] transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-300 group-hover:text-white">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                        </svg>
                                    </div>
                                    <span className="pt-1">{settings.email}</span>
                                </li>
                            )}
                            {settings?.address && (
                                <li className="flex items-start gap-3 group">
                                    <div className="min-w-[2rem] w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-[#17457C] transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-300 group-hover:text-white">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                                        </svg>
                                    </div>
                                    <span className="pt-1 whitespace-pre-wrap">{settings.address}</span>
                                </li>
                            )}
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/5 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center gap-6 text-sm">
                    <div className="text-gray-500 text-center md:text-left">
                        <p>© {new Date().getFullYear()} {settings?.companyName || "Bardakcı Bike"}. Tüm hakları saklıdır.</p>
                        <p className="mt-1 flex items-center justify-center md:justify-start gap-1">
                            Designed & Developed by
                            <a
                                href="https://www.hasandurmus.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#17457C] hover:text-white transition-colors font-medium"
                            >
                                Hasan Durmuş
                            </a>
                        </p>
                    </div>

                    {/* Payment Icons */}
                    <div className="flex items-center gap-3 opacity-80 grayscale hover:grayscale-0 transition-all duration-300">
                        <div className="bg-white rounded px-2 h-8 min-w-[3rem] flex items-center justify-center p-1 shadow-sm" title="Visa">
                            <strong style={{ color: "#1A1F71", fontStyle: "italic", fontFamily: "Helvetica, Arial, sans-serif", fontSize: "1rem", lineHeight: 1, letterSpacing: "-0.5px", fontWeight: 900 }}>VISA</strong>
                        </div>
                        <div className="bg-white rounded px-2 h-8 min-w-[3rem] flex items-center justify-center shadow-sm" title="Mastercard">
                            <svg viewBox="0 0 24 15" className="h-full w-auto max-w-full">
                                <rect fill="none" width="24" height="15" />
                                <circle cx="7" cy="7.5" r="7" fill="#EB001B" />
                                <circle cx="17" cy="7.5" r="7" fill="#F79E1B" fillOpacity="0.8" />
                            </svg>
                        </div>
                        <div className="bg-white rounded px-2 h-8 min-w-[3rem] flex items-center justify-center shadow-sm" title="Troy">
                            <strong className="text-blue-900 text-xs font-black tracking-tighter">TROY</strong>
                        </div>
                        {(settings?.showBankTransfer === "true") && (
                            <div className="bg-white rounded px-2 h-8 min-w-[3rem] flex items-center justify-center shadow-sm" title="Havale / EFT">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-700">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
                                </svg>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </footer>
    );
}
