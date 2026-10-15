import Image from "next/image";

/**
 * Giriş / kayıt / şifre sayfalarının üstündeki logo.
 * Logolar yatay olduğu için kare kutu yerine geniş, beyaz bir alan kullanılır (önceden 80x80 kareye sıkışıp küçük görünüyordu).
 * onDark: koyu başlık şeridinin üzerinde beyaz kart; onLight: beyaz kartın içinde çerçevesiz.
 */
export function AuthLogo({
    logoUrl,
    siteName,
    variant = "onDark",
}: {
    logoUrl?: string;
    siteName?: string;
    variant?: "onDark" | "onLight";
}) {
    const box =
        variant === "onDark"
            ? "bg-white rounded-2xl shadow-lg px-5 py-3"
            : "px-2 py-1";

    return (
        <div className={`mx-auto mb-4 flex items-center justify-center ${box}`} style={{ width: "min(100%, 260px)" }}>
            {logoUrl ? (
                <div className="relative h-14 w-full sm:h-16">
                    <Image
                        src={logoUrl}
                        alt={siteName || "Logo"}
                        fill
                        sizes="260px"
                        priority
                        className="object-contain"
                    />
                </div>
            ) : (
                <span className="text-[#17457C] font-black text-2xl py-3">
                    {siteName || "Hoş Geldiniz"}
                </span>
            )}
        </div>
    );
}
