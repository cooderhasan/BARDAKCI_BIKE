import { redirect } from "next/navigation";

interface OrdersDetailPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function OrderDetailPage({ params }: OrdersDetailPageProps) {
    const { id } = await params;
    redirect(`/admin/orders?search=${id}&open=${id}`);
}
