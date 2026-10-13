import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Yönetim server action'larının başında çağrılır: Server Action'lar herkese açık HTTP uç noktalarıdır,
 * /admin middleware kontrolüne güvenmeden yetkiyi burada da doğrularız.
 *
 * İstek dışında (BullMQ kuyruğu, cron, instrumentation) çalışan çağrılarda HTTP isteği yoktur;
 * dışarıdan gelen her çağrı bir istek olduğundan bu durum güvenlidir ve otomatik senkronlar etkilenmez.
 */
export async function requireAdmin(): Promise<void> {
    try {
        await headers();
    } catch {
        return; // istek bağlamı yok: kuyruk/cron içi çağrı
    }

    const session = await auth();
    const role = session?.user?.role;
    if (role !== "ADMIN" && role !== "OPERATOR") {
        throw new Error("Bu işlem için yönetici girişi gerekli.");
    }
}

/** API route'ları için: yetkisizse 401 yanıtı döndürmek üzere true/false verir */
export async function isAdminRequest(): Promise<boolean> {
    const session = await auth();
    const role = session?.user?.role;
    return role === "ADMIN" || role === "OPERATOR";
}
