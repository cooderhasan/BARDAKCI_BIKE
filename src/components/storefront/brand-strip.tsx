import Link from "next/link";
import Image from "next/image";

interface BrandLogo {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
}

/**
 * Ana sayfa marka şeridi: logosu yüklenmiş markalar (admin > Markalar).
 * Logolar her zaman renkli (gri ton fazla soluk duruyordu); üzerine gelince kutu kalkar, gölge ve lacivert çerçeve
 * belirir, logo hafifçe büyür. Tıklayınca o markanın ürünleri listelenir.
 */
export function BrandStrip({ brands }: { brands: BrandLogo[] }) {
    const list = brands.filter((b) => b.logoUrl);
    if (list.length < 2) return null;

    return (
        <section>
            <div className="flex items-center gap-2 mb-1.5">
                <span className="h-px w-6 bg-[#17457C] dark:bg-blue-400" />
                <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.18em] text-[#17457C] dark:text-blue-400">
                    Güvendiğiniz Markalar
                </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-5 md:mb-7">
                Markalarımız
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
                {list.map((brand) => (
                    <Link
                        key={brand.id}
                        href={`/products?brands=${encodeURIComponent(brand.slug)}`}
                        title={`${brand.name} ürünleri`}
                        className="group relative aspect-[2/1] rounded-xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/60 dark:ring-gray-700 hover:ring-2 hover:ring-[#17457C]/40 hover:shadow-[0_10px_28px_-8px_rgba(23,69,124,0.25)] md:hover:-translate-y-1 transition-all duration-300"
                    >
                        <Image
                            src={brand.logoUrl as string}
                            alt={brand.name}
                            fill
                            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 200px"
                            className="object-contain p-3 md:p-4 transition-transform duration-300 group-hover:scale-105"
                        />
                    </Link>
                ))}
            </div>
        </section>
    );
}
