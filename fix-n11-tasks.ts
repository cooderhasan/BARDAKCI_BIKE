import { prisma } from "./src/lib/db";
import { N11Client } from "./src/services/n11/api";

async function fixN11Tasks() {
    console.log("📡 N11 Görevleri güncelleniyor...");

    // Bekleyen veya İşlemde olan görevleri çek (Kimlik kontrolü olmadan)
    const pendingTasks = await (prisma as any).n11Task.findMany({
        where: {
            status: { in: ["PENDING", "IN_PROGRESS"] }
        },
        include: {
            n11Product: {
                include: {
                    product: {
                        select: { name: true, sku: true, id: true }
                    }
                }
            }
        }
    });

    if (pendingTasks.length === 0) {
        console.log("✅ Güncellenecek bekleyen görev bulunamadı.");
        return;
    }

    console.log(`🔍 ${pendingTasks.length} adet görev bulundu. N11'den sorgulanıyor...`);

    const client = new N11Client();
    await client.init();

    for (const task of pendingTasks) {
        try {
            const res = await client.getTaskDetails(task.taskId);
            if (res.success && res.data) {
                const rawStatus = String(res.data.status || res.data.state || res.data.result || "").toUpperCase();
                
                let n11Status = "PENDING";
                const successStates = ["COMPLETED", "SUCCESS", "FINISHED", "PROCESSED", "DONE"];
                const failedStates = ["FAILED", "ERROR", "REJECTED", "FAIL", "CANCELLED"];
                const processingStates = ["IN_PROGRESS", "PROCESSING", "WORKING", "RUNNING"];

                if (successStates.includes(rawStatus)) n11Status = "COMPLETED";
                else if (failedStates.includes(rawStatus)) n11Status = "FAILED";
                else if (processingStates.includes(rawStatus)) n11Status = "IN_PROGRESS";

                // Check individual items for detailed status/errors
                const items = res.data.items || res.data.skus?.content || res.data.content || [];
                let detailedError = null;

                if (items.length > 0) {
                    const anyItemFailed = items.some((item: any) => 
                        failedStates.includes(String(item.status || "").toUpperCase())
                    );
                    const allItemsSuccess = items.every((item: any) => 
                        successStates.includes(String(item.status || "").toUpperCase())
                    );

                    if (anyItemFailed) {
                        n11Status = "FAILED";
                        const firstFail = items.find((item: any) => failedStates.includes(String(item.status || "").toUpperCase()));
                        detailedError = firstFail?.reasons ? (Array.isArray(firstFail.reasons) ? firstFail.reasons.join(", ") : String(firstFail.reasons)) : (firstFail?.errorDescription || firstFail?.errorMessage || "Ürün hatası");
                    } else if (allItemsSuccess) {
                        n11Status = "COMPLETED";
                    }
                }

                if (n11Status !== task.status || detailedError) {
                    await (prisma as any).n11Task.update({
                        where: { id: task.id },
                        data: { 
                            status: n11Status,
                            errorMessage: detailedError || (n11Status === "PENDING" ? `N11 Durumu: ${rawStatus}` : null)
                        }
                    });
                    console.log(`✅ Görev #${task.taskId} güncellendi -> ${n11Status}`);

                    if (n11Status === "COMPLETED") {
                        await (prisma as any).n11Product.update({
                            where: { id: task.n11ProductId },
                            data: { isSynced: true, lastSyncedAt: new Date(), lastSyncError: null }
                        });
                    }
                }
            }
        } catch (e: any) {
            console.error(`❌ Görev #${task.taskId} hatası:`, e.message);
        }
    }

    console.log("🏁 İşlem tamamlandı.");
}

fixN11Tasks()
    .catch(console.error)
    .finally(() => process.exit());
