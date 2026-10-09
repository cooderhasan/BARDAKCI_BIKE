import { revalidatePath } from "next/cache";

/**
 * revalidatePath, kullanıcı isteği dışında (BullMQ kuyruğu, cron) çağrılınca
 * "Invariant: static generation store missing" hatası fırlatır. Pazaryeri senkronları kuyruktan da
 * çalıştığı için bu hata başarılı bir gönderimi hatalı gösteriyor ve işi tekrar denetiyordu.
 * Önbellek yenilemesi kritik olmadığından hata yutulur.
 */
export function safeRevalidatePath(...args: Parameters<typeof revalidatePath>): void {
    try {
        revalidatePath(...args);
    } catch {
        // İstek bağlamı yok (kuyruk/cron); sayfa bir sonraki istekte zaten taze veri çeker
    }
}
