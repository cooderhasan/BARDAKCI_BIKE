import ProductsPage from "../products/page";

interface PageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const metadata = {
    title: "İndirimli Ürünler",
    description: "En uygun fiyatlı fırsat ve kampanya ürünleri.",
    alternates: {
        canonical: "/indirimli-urunler"
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
