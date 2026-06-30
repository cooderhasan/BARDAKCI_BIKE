import ProductsPage from "../products/page";

interface PageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const metadata = {
    title: "İndirimli Ürünler | Bardakcı Bike",
    description: "En uygun fiyatlı bisiklet modelleri ve fırsat ürünleri.",
    alternates: {
        canonical: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr"}/indirimli-urunler`
    }
};

export default async function DiscountedProductsPage({ searchParams }: PageProps) {
    const params = await searchParams;

    // Inject is_on_sale=true into searchParams
    const newSearchParams = Promise.resolve({
        ...params,
        is_on_sale: "true"
    });

    return <ProductsPage searchParams={newSearchParams as any} />;
}
